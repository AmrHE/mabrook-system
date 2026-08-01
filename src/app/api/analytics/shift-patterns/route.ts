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

const SESSION_LABELS: Record<string, string> = {
  "1": "جلسة واحدة",
  "2": "جلستان",
  "3": "3 جلسات",
  "4": "4+ جلسات",
};

/**
 * When employees arrive, how long they work, and how often they split a day.
 *
 * Two arrival series, because a shift is now a DAY rather than a check-in:
 *   byFirstCheckInHour — the day's first arrival, the punctuality picture. This
 *     is strictly better than the old single series: a 15:00 restart used to
 *     land in the histogram as if it were an arrival.
 *   byCheckInHour      — every session start, the "when are people on site" view.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const byShiftOwner = excludeUsers("userId", await getExcludedUserIds());
    const inRange = { startTime: { $gte: from, $lt: to }, ...byShiftOwner };

    const [byHourRaw, bySessionHourRaw, durBinsRaw, sessionBinsRaw] = await Promise.all([
      Shift.aggregate([
        { $match: inRange },
        { $group: { _id: { $hour: { date: "$startTime", timezone: TIMEZONE } }, count: { $sum: 1 } } },
      ]),
      Shift.aggregate([
        { $match: inRange },
        // Legacy rows have no segments; fall back to the shift's own start so
        // they still appear in the all-sessions view.
        {
          $project: {
            starts: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$segments", []] } }, 0] },
                "$segments.startTime",
                ["$startTime"],
              ],
            },
          },
        },
        { $unwind: "$starts" },
        { $group: { _id: { $hour: { date: "$starts", timezone: TIMEZONE } }, count: { $sum: 1 } } },
      ]),
      Shift.aggregate([
        { $match: { status: shiftStatus.ENDED, endTime: { $ne: null }, ...inRange } },
        // Bin on WORKED hours, not the span. Post-collapse the span covers the
        // whole day including breaks, so a 09:00-12:00 + 16:00-19:00 day would
        // land in "8+ س" when the employee actually worked six hours.
        {
          $project: {
            durH: {
              $cond: [
                { $gt: [{ $ifNull: ["$workedMinutes", 0] }, 0] },
                { $divide: ["$workedMinutes", 60] },
                { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] },
              ],
            },
          },
        },
        { $match: { durH: { $gte: 0 } } },
        { $bucket: { groupBy: "$durH", boundaries: [0, 2, 4, 6, 8, 1000], default: "8", output: { count: { $sum: 1 } } } },
      ]),
      Shift.aggregate([
        { $match: inRange },
        { $project: { sessions: { $max: [1, { $size: { $ifNull: ["$segments", []] } }] } } },
        { $bucket: { groupBy: "$sessions", boundaries: [1, 2, 3, 4], default: "4", output: { count: { $sum: 1 } } } },
      ]),
    ]);

    // Fill 0..23 hours for a clean axis.
    const fillHours = (raw: any[]) => {
      const map = new Map<number, number>(raw.map((h) => [h._id, h.count]));
      return Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}`, count: map.get(hour) || 0 }));
    };

    const byFirstCheckInHour = fillHours(byHourRaw as any[]);
    const byCheckInHour = fillHours(bySessionHourRaw as any[]);

    const durationBins = (durBinsRaw as any[]).map((b) => ({ label: DUR_LABELS[String(b._id)] ?? String(b._id), count: b.count }));
    const sessionBins = (sessionBinsRaw as any[]).map((b) => ({ label: SESSION_LABELS[String(b._id)] ?? String(b._id), count: b.count }));

    return NextResponse.json(
      {
        // Kept as an alias for one release so an older client can't 404.
        byStartHour: byFirstCheckInHour,
        byFirstCheckInHour,
        byCheckInHour,
        durationBins,
        sessionBins,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute shift patterns" }, { status: 500 });
  }
}
