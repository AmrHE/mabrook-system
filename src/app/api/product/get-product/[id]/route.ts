import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Product } from "@/models/Product";
import { Hospital } from "@/models/Hospital";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;

  
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  if(userPayload.role === userRoles.EMPLOYEE) {
    return NextResponse.json({status: 403, message: "You are not authorized to view this product"}, { status: 403 });
  }

  const product = await Product.findOne({_id: id, isActive: true})
  .populate('createdBy', 'email firstName lastName');

  if(!product) {
    return NextResponse.json({status: 404, message: "No product found with the provided ID"})
  }

  // Per-hospital breakdown: where this box's stock currently sits. Powers the
  // stock table on the box detail page (/products/[id]).
  const perHospital = await Hospital.aggregate([
    { $match: { isActive: true } },
    { $unwind: "$productStocks" },
    { $match: { "productStocks.product": new mongoose.Types.ObjectId(id) } },
    {
      $project: {
        _id: 0,
        hospitalId: "$_id",
        hospitalName: { $ifNull: ["$name", "غير محدد"] },
        city: { $ifNull: ["$city", ""] },
        quantity: { $ifNull: ["$productStocks.quantity", 0] },
        lastRestockedAt: "$productStocks.lastRestockedAt",
      },
    },
    { $sort: { quantity: -1 } },
  ]);

  return NextResponse.json({ message: "Product fetched successfully", product, perHospital }, { status: 200 });
}
