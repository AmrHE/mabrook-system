/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, parseGranularity, TIMEZONE } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * Funnel/conversion metrics bucketed over time (day/week/month): per period,
 * how many mothers were registered, consented, signed, and completed a survey.
 * These are overlapping subsets (not additive) — meant for synchronized area
 * panels, not a stacked chart.
 */
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
        $addFields: {
          _surveyed: {
            $cond: [
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: {
                          $reduce: {
                            input: { $ifNull: ["$survey", []] },
                            initialValue: [],
                            in: { $concatArrays: ["$$value", { $ifNull: ["$$this.QA", []] }] },
                          },
                        },
                        as: "qa",
                        cond: { $and: [{ $ne: ["$$qa.answer", ""] }, { $ne: ["$$qa.answer", null] }] },
                      },
                    },
                  },
                  0,
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: "$createdAt", unit: granularity, timezone: TIMEZONE } },
          moms: { $sum: 1 },
          consent: { $sum: { $cond: ["$allowFutureCom", 1, 0] } },
          signed: {
            $sum: { $cond: [{ $and: [{ $ne: ["$signature", ""] }, { $ne: ["$signature", null] }] }, 1, 0] },
          },
          surveyed: { $sum: "$_surveyed" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", moms: 1, consent: 1, signed: 1, surveyed: 1 } },
    ]);

    return NextResponse.json({ granularity, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute conversion timeseries" }, { status: 500 });
  }
}
