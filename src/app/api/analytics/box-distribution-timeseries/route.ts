/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, parseGranularity, TIMEZONE } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * Boxes distributed over time, bucketed by granularity and split by box. Long
 * form (one row per date/box) plus the distinct box axis (ordered by total), so
 * the client can pivot into a multi-line trend.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const granularity = parseGranularity(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const points = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $unwind: "$survey" },
      {
        $group: {
          _id: {
            date: { $dateTrunc: { date: "$createdAt", unit: granularity, timezone: TIMEZONE } },
            box: "$survey.product",
          },
          count: { $sum: 1 },
        },
      },
      { $lookup: { from: "products", localField: "_id.box", foreignField: "_id", as: "p" } },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          boxId: "$_id.box",
          boxName: { $ifNull: ["$p.name", "غير محدد"] },
          count: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    const boxTotals = new Map<string, { id: string; name: string; total: number }>();
    for (const p of points as any[]) {
      const b = boxTotals.get(String(p.boxId)) || { id: String(p.boxId), name: p.boxName, total: 0 };
      b.total += p.count;
      boxTotals.set(String(p.boxId), b);
    }
    const boxes = [...boxTotals.values()].sort((a, b) => b.total - a.total);

    return NextResponse.json({ granularity, points, boxes }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute box distribution timeseries" }, { status: 500 });
  }
}
