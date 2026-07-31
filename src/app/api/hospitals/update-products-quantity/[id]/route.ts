/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Hospital } from "@/models/Hospital";
import { User } from "@/models/User";
import { recomputeProductStock } from "@/utils/stock/recompute";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {
  const { id } = await params;
  const reqBody = await req.json();
  const { hospitalQuantities } = reqBody;

  await initDb();

  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken) {
    return NextResponse.json({ status: 401, message: "Session has timed out. Please log in to use Mabrook System" }, { status: 401 });
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string };

  if (!userPayload) {
    return NextResponse.json({ status: 400, message: "Cannot identify the user Please re-login and try again" }, { status: 400 });
  }

  // Admins and warehouse users can edit any hospital's stock. Employees can edit
  // only the hospitals they are assigned to.
  if (userPayload.role === userRoles.EMPLOYEE) {
    const user = await User.findById(userPayload._id).select("assignedHospitals");
    const assigned = (user?.assignedHospitals || []).map((h: any) => h.toString());
    if (!assigned.includes(id)) {
      return NextResponse.json({ status: 403, message: "This Action is not allowed for you" }, { status: 403 });
    }
  }
  /***************AUTH GAURD END****************/

  if (!Array.isArray(hospitalQuantities) || hospitalQuantities.length === 0) {
    return NextResponse.json({ status: 400, message: "hospitalQuantities must be a non-empty array" }, { status: 400 });
  }

  const session = await mongoose.startSession();
  let transactionError: any = null;

  try {
    await session.withTransaction(async () => {
      const hospital = await Hospital.findById(id).session(session);
      if (!hospital) throw new Error("Hospital not found");

      const affectedProducts = new Set<string>();

      // Apply requested absolute quantities in-memory. Warehouse is paused, so we
      // no longer move stock in/out of a central pool — the hospital number is the
      // source of truth and the box totals are recomputed from it below.
      for (const { productId, quantity } of hospitalQuantities) {
        const pidStr = productId.toString();
        const newQty = Number(quantity) || 0;

        const existingStock: { product: mongoose.Types.ObjectId; quantity: number; lastRestockedAt?: Date } | undefined =
          hospital.productStocks.find(
            (ps: { product: mongoose.Types.ObjectId; quantity: number; lastRestockedAt?: Date }) => ps.product.toString() === pidStr
          );
        const prevQty = existingStock ? (existingStock.quantity || 0) : 0;
        const delta = newQty - prevQty;

        if (existingStock) {
          existingStock.quantity = newQty;
          // Stamp lastRestockedAt only when quantity actually increased.
          if (delta > 0) existingStock.lastRestockedAt = new Date();
        } else {
          hospital.productStocks.push({
            product: new mongoose.Types.ObjectId(pidStr),
            quantity: newQty,
            lastRestockedAt: newQty > 0 ? new Date() : undefined,
          } as any);
        }

        if (delta !== 0) affectedProducts.add(pidStr);
      }

      await hospital.save({ session });

      // Recompute each affected box's denormalized totals from all hospitals.
      for (const pidStr of affectedProducts) {
        await recomputeProductStock(pidStr, session);
      }
    });
  } catch (err: any) {
    transactionError = err;
  } finally {
    await session.endSession();
  }

  if (transactionError) {
    return NextResponse.json({ status: 500, message: transactionError.message || "Transaction failed" }, { status: 500 });
  }

  return NextResponse.json({ message: "Hospital updated successfully" }, { status: 200 });
}
