/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Hospital } from "@/models/Hospital";
import { getSettings } from "@/utils/settings/getSettings";

export const dynamic = "force-dynamic";

/**
 * Per-hospital stock alerts for the "⚠ يحتاج انتباه" panel: one row per
 * hospital × box whose on-hand quantity is below the low-stock threshold.
 *
 * The products-consumption endpoint only knows each box's total across every
 * hospital, which hides the case this exists for — a box that is plentiful
 * overall but has run out at one specific hospital. Rows are worst-first so the
 * panel can show the most urgent ones and link straight to the hospital page.
 *
 * Current snapshot, not date-ranged: stock levels are a "right now" fact.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { outOfStockThreshold, lowStockThreshold } = await getSettings();

    const data = await Hospital.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$productStocks" },
      { $lookup: { from: "products", localField: "productStocks.product", foreignField: "_id", as: "p" } },
      { $unwind: "$p" },
      // Skip stock rows whose box was deleted / deactivated.
      { $match: { "p.isActive": true } },
      { $addFields: { quantity: { $ifNull: ["$productStocks.quantity", 0] } } },
      { $match: { quantity: { $lt: lowStockThreshold } } },
      {
        $project: {
          _id: 0,
          hospitalId: "$_id",
          hospitalName: { $ifNull: ["$name", "غير محدد"] },
          productId: "$productStocks.product",
          productName: { $ifNull: ["$p.name", "غير محدد"] },
          quantity: 1,
        },
      },
      { $sort: { quantity: 1, hospitalName: 1, productName: 1 } },
    ]);

    return NextResponse.json(
      { data, thresholds: { outOfStock: outOfStockThreshold, lowStock: lowStockThreshold } },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "Failed to compute hospital stock alerts" },
      { status: 500 },
    );
  }
}
