/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Visit } from "@/models/Visit";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

const BIN_LABELS: Record<string, string> = {
  "0": "< 30 د",
  "0.5": "30-60 د",
  "1": "1-2 س",
  "2": "2-3 س",
  "3": "3-6 س",
  "6": "6+ س",
};

/** Distribution of visit durations (ENDED visits with endTime). */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const result = await Visit.aggregate([
      {
        $match: {
          isActive: true,
          status: shiftStatus.ENDED,
          endTime: { $ne: null },
          createdAt: { $gte: from, $lt: to },
          ...excludeUsers("createdBy", excludedIds),
        },
      },
      { $project: { durH: { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] } } },
      { $match: { durH: { $gte: 0 } } },
      {
        $facet: {
          bins: [
            { $bucket: { groupBy: "$durH", boundaries: [0, 0.5, 1, 2, 3, 6, 1000], default: "6", output: { count: { $sum: 1 } } } },
          ],
          stats: [{ $group: { _id: null, avg: { $avg: "$durH" } } }],
        },
      },
    ]);

    const rawBins = result[0]?.bins || [];
    const bins = rawBins.map((b: any) => ({ label: BIN_LABELS[String(b._id)] ?? String(b._id), count: b.count }));
    const avgHours = Math.round((result[0]?.stats?.[0]?.avg || 0) * 10) / 10;

    return NextResponse.json({ bins, avgHours }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute visit durations" }, { status: 500 });
  }
}
