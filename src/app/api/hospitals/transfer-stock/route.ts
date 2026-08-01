/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Hospital } from "@/models/Hospital";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { recomputeProductStock } from "@/utils/stock/recompute";

type StockEntry = { product: mongoose.Types.ObjectId; quantity?: number; lastRestockedAt?: Date | null };

/** Application error whose message is safe to show the user, with its own status. */
class TransferError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * Move boxes from one hospital to another.
 *
 * Stock is unevenly distributed in practice — one hospital sits on a pile while
 * another runs dry — and the only tool until now was editing both hospitals'
 * absolute quantities by hand, which is two non-atomic saves that silently
 * create or destroy stock if one of them fails.
 *
 * Admin/warehouse can move between any two hospitals; an employee only between
 * two hospitals they are both assigned to (same rule as update-products-quantity,
 * applied to each side of the move).
 *
 * POST /api/hospitals/transfer-stock
 * body: { fromHospitalId, toHospitalId, items: [{ productId, quantity }] }
 */
export async function POST(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload?._id) {
    return NextResponse.json(
      { status: 400, message: "Cannot identify the user Please re-login and try again" },
      { status: 400 },
    );
  }

  const { fromHospitalId, toHospitalId, items } = await req.json();

  if (!mongoose.isValidObjectId(fromHospitalId) || !mongoose.isValidObjectId(toHospitalId)) {
    return NextResponse.json({ status: 400, message: "معرّف المستشفى غير صالح" }, { status: 400 });
  }
  if (String(fromHospitalId) === String(toHospitalId)) {
    return NextResponse.json({ status: 400, message: "لا يمكن النقل إلى نفس المستشفى" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ status: 400, message: "الرجاء تحديد كمية واحدة على الأقل للنقل" }, { status: 400 });
  }

  // Collapse duplicate rows for the same box so a hand-crafted body can't slip
  // past the per-box availability check by splitting one amount across two rows.
  const requested = new Map<string, number>();
  for (const item of items) {
    const productId = String(item?.productId ?? "");
    const quantity = Number(item?.quantity);
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ status: 400, message: "معرّف المنتج غير صالح" }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ status: 400, message: "الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر" }, { status: 400 });
    }
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }

  // Employees may only move stock between hospitals they hold. Checked before
  // any read of the hospitals so it can't be used to probe which ids exist.
  if (userPayload.role === userRoles.EMPLOYEE) {
    const me = await User.findById(userPayload._id).select("assignedHospitals").lean();
    const assigned = ((me as { assignedHospitals?: unknown[] } | null)?.assignedHospitals || []).map((h) => String(h));
    if (!assigned.includes(String(fromHospitalId)) || !assigned.includes(String(toHospitalId))) {
      return NextResponse.json(
        { status: 403, message: "يمكنك النقل بين المستشفيات المعيّنة لك فقط" },
        { status: 403 },
      );
    }
  }

  const productIds = [...requested.keys()];
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).select("name").lean();
  const nameById = new Map(products.map((p: any) => [String(p._id), p.name || "منتج"]));
  if (nameById.size !== productIds.length) {
    return NextResponse.json({ status: 400, message: "أحد المنتجات المحددة غير موجود أو غير مفعّل" }, { status: 400 });
  }

  const session = await mongoose.startSession();
  let transactionError: any = null;

  try {
    await session.withTransaction(async () => {
      // Sequential, not Promise.all: a ClientSession cannot serve concurrent ops.
      const from = await Hospital.findById(fromHospitalId).session(session);
      if (!from) throw new TransferError("المستشفى المصدر غير موجود", 404);
      const to = await Hospital.findById(toHospitalId).session(session);
      if (!to) throw new TransferError("المستشفى الوجهة غير موجود", 404);

      const now = new Date();

      for (const [productId, quantity] of requested) {
        const source: StockEntry | undefined = from.productStocks.find(
          (ps: StockEntry) => ps.product?.toString() === productId,
        );
        const available = source?.quantity || 0;
        // Unlike distributing to a mom ("warn but allow"), a transfer that
        // overdraws would invent stock at the destination — so it's a hard stop.
        if (available < quantity) {
          throw new TransferError(
            `الكمية المتاحة من "${nameById.get(productId)}" في ${from.name} هي ${available} فقط`,
          );
        }
        source!.quantity = available - quantity;

        const target: StockEntry | undefined = to.productStocks.find(
          (ps: StockEntry) => ps.product?.toString() === productId,
        );
        if (target) {
          target.quantity = (target.quantity || 0) + quantity;
          target.lastRestockedAt = now;
        } else {
          // Destination never carried this box (created after the hospital was).
          to.productStocks.push({
            product: new mongoose.Types.ObjectId(productId),
            quantity,
            lastRestockedAt: now,
          } as any);
        }
      }

      await from.save({ session });
      await to.save({ session });

      // The company-wide total is unchanged by a move, but recomputing keeps the
      // denormalized counters on Product self-healing if they ever drifted.
      for (const productId of productIds) {
        await recomputeProductStock(productId, session);
      }
    });
  } catch (err: any) {
    transactionError = err;
  } finally {
    await session.endSession();
  }

  if (transactionError) {
    const status = transactionError instanceof TransferError ? transactionError.status : 500;
    return NextResponse.json(
      { status, message: transactionError.message || "تعذّر نقل المخزون" },
      { status },
    );
  }

  return NextResponse.json({ message: "تم نقل المخزون بنجاح" }, { status: 200 });
}
