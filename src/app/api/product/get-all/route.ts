import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Product } from "@/models/Product";
import { getSettings } from "@/utils/settings/getSettings";

export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const products = await Product
  .find({isActive: true})
  .populate('createdBy', 'email firstName lastName')
  .sort({ totalQuantity: 1 });

  if(!products) {
    return NextResponse.json({status: 404, message: "No products found"})
  }

  // Admin-configured stock-status thresholds, so the list badge stays in sync.
  const { outOfStockThreshold, lowStockThreshold } = await getSettings();

  return NextResponse.json(
    { message: "Products fetched successfully", products, thresholds: { outOfStock: outOfStockThreshold, lowStock: lowStockThreshold } },
    { status: 200 },
  );
}
