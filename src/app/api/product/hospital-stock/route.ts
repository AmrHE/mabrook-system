/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Visit } from "@/models/Visit";
import { Hospital } from "@/models/Hospital";
import { Product } from "@/models/Product";

export const dynamic = "force-dynamic";

/**
 * Box stock for the hospital of a given visit. Used by the mom-creation form to
 * populate the box dropdown with the remaining quantity at that hospital.
 *
 * Returns every active box (merged with the hospital's on-hand counts, default
 * 0) so the employee can always pick a box even if the hospital has none left
 * ("show all, warn but allow").
 *
 * GET /api/product/hospital-stock?visitId=<id>
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;
  if (!userPayload) {
    return NextResponse.json({ status: 400, message: "Cannot identify the user Please re-login and try again" }, { status: 400 });
  }

  const visitId = req.nextUrl.searchParams.get("visitId");
  if (!visitId) {
    return NextResponse.json({ status: 400, message: "visitId is required" }, { status: 400 });
  }

  const visit = await Visit.findById(visitId).select("hospitalId");
  if (!visit) {
    return NextResponse.json({ status: 404, message: "Visit not found" }, { status: 404 });
  }

  // On-hand quantities at this visit's hospital, keyed by product id.
  const hospital = visit.hospitalId
    ? await Hospital.findById(visit.hospitalId).select("productStocks")
    : null;
  const qtyByProduct = new Map<string, number>();
  for (const ps of hospital?.productStocks || []) {
    if (ps?.product) qtyByProduct.set(ps.product.toString(), ps.quantity || 0);
  }

  // Every active box, merged with the hospital's counts (default 0).
  const products = await Product.find({ isActive: true }).select("name").sort({ name: 1 }).lean();
  const boxes = (products as any[]).map((p) => ({
    productId: (p._id as mongoose.Types.ObjectId).toString(),
    name: p.name || "غير محدد",
    quantity: qtyByProduct.get((p._id as mongoose.Types.ObjectId).toString()) ?? 0,
  }));

  return NextResponse.json({ hospitalId: visit.hospitalId, boxes }, { status: 200 });
}
