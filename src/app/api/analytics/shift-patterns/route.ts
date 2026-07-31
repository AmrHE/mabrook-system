/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

const DUR_LABELS: Record<string, string> = {
  "0": "< 2 س",
  "2": "2-4 س",
  "4": "4-6 س",
  "6": "6-8 س",
  "8": "8+ س",
};

/** Shift start-hour distribution + shift-length distribution (ENDED shifts). */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const byShiftOwner = excludeUsers("userId", await getExcludedUserIds());

    const [byHourRaw, durBinsRaw] = await Promise.all([
      Shift.aggregate([
        { $match: { startTime: { $gte: from, $lt: to }, ...byShiftOwner } },
        { $group: { _id: { $hour: { date: "$startTime", timezone: TIMEZONE } }, count: { $sum: 1 } } },
      ]),
      Shift.aggregate([
        { $match: { status: shiftStatus.ENDED, endTime: { $ne: null }, startTime: { $gte: from, $lt: to }, ...byShiftOwner } },
        { $project: { durH: { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] } } },
        { $match: { durH: { $gte: 0 } } },
        { $bucket: { groupBy: "$durH", boundaries: [0, 2, 4, 6, 8, 1000], default: "8", output: { count: { $sum: 1 } } } },
      ]),
    ]);

    // Fill 0..23 hours for a clean axis.
    const hourMap = new Map<number, number>((byHourRaw as any[]).map((h) => [h._id, h.count]));
    const byStartHour = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}`, count: hourMap.get(hour) || 0 }));

    const durationBins = (durBinsRaw as any[]).map((b) => ({ label: DUR_LABELS[String(b._id)] ?? String(b._id), count: b.count }));

    return NextResponse.json({ byStartHour, durationBins }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute shift patterns" }, { status: 500 });
  }
}
