/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, parseGranularity, TIMEZONE } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const granularity = parseGranularity(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const data = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      {
        $group: {
          _id: { $dateTrunc: { date: "$createdAt", unit: granularity, timezone: TIMEZONE } },
          count: { $sum: 1 },
          newborns: { $sum: { $ifNull: ["$numberOfnewborns", 0] } },
          signed: {
            $sum: { $cond: [{ $and: [{ $ne: ["$signature", ""] }, { $ne: ["$signature", null] }] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1, newborns: 1, signed: 1 } },
    ]);

    return NextResponse.json({ granularity, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute moms timeseries" }, { status: 500 });
  }
}
