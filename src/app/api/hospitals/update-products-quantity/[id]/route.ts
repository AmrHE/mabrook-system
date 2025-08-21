/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Hospital } from "@/models/Hospital";
import { Product } from "@/models/Product";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {
  const { id } = await params;
  const reqBody = await req.json();
  const { hospitalQuantities } = reqBody;
  console.log('hospitalQuantities', hospitalQuantities)

  await initDb();

  /***************ADMIN GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken) {
    return NextResponse.json({ status: 401, message: "Session has timed out. Please log in to use Mabrook System" }, { status: 401 });
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string };

  if (userPayload.role === userRoles.EMPLOYEE) {
    return NextResponse.json({ status: 403, message: "This Action is not allowed for you" }, { status: 403 });
  }
  /***************ADMIN GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({ status: 400, message: "Cannot identify the user Please re-login and try again" }, { status: 400 });
  }

  if (hospitalQuantities.length === 0) {
    return NextResponse.json({ status: 400, message: "hospitalQuantities must be a non-empty array" }, { status: 400 });
  }

  const session = await mongoose.startSession();
  let transactionError: any = null;

  try {
    await session.withTransaction(async () => {
      // Load hospital once in session
      const hospital = await Hospital.findById(id).session(session);
      if (!hospital) throw new Error("Hospital not found");

      // Map to accumulate delta per productId (string -> number)
      const deltas = new Map<string, number>();

      // Apply requested changes in-memory and compute deltas
      for (const { productId, quantity } of hospitalQuantities) {
        const pidStr = productId.toString();
        const newQty = Number(quantity) || 0;

        const existingStock: { product: mongoose.Types.ObjectId; quantity: number; lastRestockedAt?: Date } | undefined = hospital.productStocks.find(
          (ps: { product: mongoose.Types.ObjectId; quantity: number; lastRestockedAt?: Date }) => ps.product.toString() === pidStr
        );
        const prevQty = existingStock ? (existingStock.quantity || 0) : 0;
        const delta = newQty - prevQty; // positive => hospital gained items, negative => consumption

        // Update or insert the stock entry in-memory
        if (existingStock) {
          existingStock.quantity = newQty;
          // update lastRestockedAt only when we actually restock (delta > 0)
          if (delta > 0) existingStock.lastRestockedAt = new Date();
        } else {
          hospital.productStocks.push({
            product: new mongoose.Types.ObjectId(pidStr),
            quantity: newQty,
            // if newQty > 0 treat as restock
            lastRestockedAt: newQty > 0 ? new Date() : undefined
          } as any);
        }

        deltas.set(pidStr, (deltas.get(pidStr) || 0) + delta);
      }

      // Persist hospital change once (no hooks needed)
      await hospital.save({ session });

      // For each affected product apply warehouse logic only for positive deltas,
      // then recalc hospitalsQuantity and update totalQuantity.
      for (const [pidStr, delta] of deltas.entries()) {
        const productIdObj = new mongoose.Types.ObjectId(pidStr);

        // Load product inside session
        const productDoc = await Product.findById(productIdObj).session(session);
        if (!productDoc) throw new Error(`Product ${pidStr} not found`);

        let updatedProductDoc = productDoc;

        // Only adjust warehouse when hospital gained items (delta > 0).
        // Negative delta => consumption => DO NOT change warehouse.
        if (delta > 0) {
          if ((productDoc.warehouseQuantity || 0) < delta) {
            throw new Error(`Insufficient warehouse stock for product ${pidStr}`);
          }

          updatedProductDoc = await Product.findByIdAndUpdate(
            productIdObj,
            { $inc: { warehouseQuantity: -delta } },
            { new: true, session }
          );

          if (!updatedProductDoc) throw new Error(`Failed to update warehouse for product ${pidStr}`);
        }

        // Recalculate hospitalsQuantity using aggregation
        const agg = await Hospital.aggregate([
          { $unwind: "$productStocks" },
          { $match: { "productStocks.product": productIdObj } },
          { $group: { _id: null, total: { $sum: "$productStocks.quantity" } } }
        ]).session(session);

        const totalHospitalsQuantity = agg[0]?.total || 0;
        const currentWarehouseQty = (updatedProductDoc?.warehouseQuantity ?? productDoc.warehouseQuantity) || 0;

        // Update product's hospitalsQuantity and totalQuantity
        await Product.findByIdAndUpdate(
          productIdObj,
          {
            $set: {
              hospitalsQuantity: totalHospitalsQuantity,
              totalQuantity: totalHospitalsQuantity + currentWarehouseQty
            }
          },
          { session }
        );
      }
    }); // end transaction
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
