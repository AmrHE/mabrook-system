/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Product } from "@/models/Product";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { getSettings } from "@/utils/settings/getSettings";

export const dynamic = "force-dynamic";

/**
 * Per product: how many were distributed (mom.survey entries) in the range +
 * current stock levels. Starts from Product so zero-distribution products still
 * appear (needed for the low-stock attention panel).
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const { outOfStockThreshold, lowStockThreshold } = await getSettings();
    const excludedIds = await getExcludedUserIds();

    const data = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "moms",
          let: { pid: "$_id" },
          pipeline: [
            { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
            { $unwind: "$survey" },
            { $match: { $expr: { $eq: ["$survey.product", "$$pid"] } } },
            { $group: { _id: null, distributed: { $sum: 1 }, uniqueMoms: { $addToSet: "$_id" } } },
          ],
          as: "dist",
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: { $ifNull: ["$name", "غير محدد"] },
          distributed: { $ifNull: [{ $arrayElemAt: ["$dist.distributed", 0] }, 0] },
          uniqueMoms: { $size: { $ifNull: [{ $arrayElemAt: ["$dist.uniqueMoms", 0] }, []] } },
          warehouseQuantity: { $ifNull: ["$warehouseQuantity", 0] },
          hospitalsQuantity: { $ifNull: ["$hospitalsQuantity", 0] },
          totalQuantity: { $ifNull: ["$totalQuantity", 0] },
          questionsCount: { $size: { $ifNull: ["$questions", []] } },
          lowStock: { $lt: [{ $ifNull: ["$totalQuantity", 0] }, lowStockThreshold] },
        },
      },
      { $sort: { distributed: -1, totalQuantity: 1 } },
    ]);

    return NextResponse.json(
      { data, thresholds: { outOfStock: outOfStockThreshold, lowStock: lowStockThreshold } },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute products consumption" }, { status: 500 });
  }
}
