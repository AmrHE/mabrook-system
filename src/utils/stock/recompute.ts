/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { Hospital } from "@/models/Hospital";
import { Product } from "@/models/Product";

/**
 * Recompute a box/product's denormalized stock counters from the source of
 * truth — the per-hospital `productStocks`.
 *
 * The warehouse is paused, so `totalQuantity === hospitalsQuantity` (the sum of
 * on-hand stock across every hospital). Pass a `session` to run inside a
 * transaction. Returns the recomputed hospitals total.
 */
export async function recomputeProductStock(
  productId: mongoose.Types.ObjectId | string,
  session?: mongoose.ClientSession,
): Promise<number> {
  const pid = new mongoose.Types.ObjectId(productId);

  const aggQuery = Hospital.aggregate([
    { $unwind: "$productStocks" },
    { $match: { "productStocks.product": pid } },
    { $group: { _id: null, total: { $sum: "$productStocks.quantity" } } },
  ]);
  if (session) aggQuery.session(session);
  const agg = await aggQuery;

  const hospitalsQuantity = agg[0]?.total || 0;

  await Product.findByIdAndUpdate(
    pid,
    // Warehouse dormant: total is purely the sum across hospitals.
    { $set: { hospitalsQuantity, totalQuantity: hospitalsQuantity } },
    { session },
  );

  return hospitalsQuantity;
}

/**
 * Adjust a single hospital's on-hand quantity for a box by `delta` (e.g. -1 when
 * a box is handed to a mom, +1 when that mom is deleted), then recompute the
 * box's denormalized totals. Creates the `productStocks` entry if the hospital
 * doesn't have one yet. Quantities may go negative (distribution is "warn but
 * allow"). Pass a `session` to run inside a transaction.
 */
export async function adjustHospitalStock(
  hospitalId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  delta: number,
  session?: mongoose.ClientSession,
): Promise<void> {
  const hid = new mongoose.Types.ObjectId(hospitalId);
  const pid = new mongoose.Types.ObjectId(productId);

  const res = await Hospital.updateOne(
    { _id: hid, "productStocks.product": pid },
    { $inc: { "productStocks.$.quantity": delta } },
    { session },
  );

  // No entry for this box at this hospital yet — seed one at `delta`.
  if (res.matchedCount === 0) {
    await Hospital.updateOne(
      { _id: hid },
      { $push: { productStocks: { product: pid, quantity: delta, lastRestockedAt: null } } },
      { session },
    );
  }

  await recomputeProductStock(pid, session);
}
