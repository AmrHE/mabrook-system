/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Product } from "@/models/Product";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * Burn-rate projection per product: consumption (survey distributions) in the
 * range → daily rate → estimated days to stockout against current totalQuantity.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const rangeDays = Math.max(1, (to.getTime() - from.getTime()) / 86400000);
    const excludedIds = await getExcludedUserIds();

    const raw = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "moms",
          let: { pid: "$_id" },
          pipeline: [
            { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
            { $unwind: "$survey" },
            { $match: { $expr: { $eq: ["$survey.product", "$$pid"] } } },
            { $count: "n" },
          ],
          as: "dist",
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: { $ifNull: ["$name", "غير محدد"] },
          totalQuantity: { $ifNull: ["$totalQuantity", 0] },
          distributed: { $ifNull: [{ $arrayElemAt: ["$dist.n", 0] }, 0] },
        },
      },
    ]);

    const data = (raw as any[])
      .map((p) => {
        const dailyRate = Math.round((p.distributed / rangeDays) * 100) / 100;
        const daysToStockout = dailyRate > 0 ? Math.round(p.totalQuantity / dailyRate) : null;
        return { ...p, dailyRate, daysToStockout };
      })
      // Soonest-to-run-out first; products with no consumption (null) go last.
      .sort((a, b) => {
        if (a.daysToStockout === null) return 1;
        if (b.daysToStockout === null) return -1;
        return a.daysToStockout - b.daysToStockout;
      });

    return NextResponse.json({ rangeDays: Math.round(rangeDays), data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute inventory projection" }, { status: 500 });
  }
}
