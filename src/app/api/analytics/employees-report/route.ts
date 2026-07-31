/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { userRoles, shiftStatus } from "@/models/enum.constants";
import { User } from "@/models/User";
import { getSettings } from "@/utils/settings/getSettings";
import {
  EMPTY_SHIFT_STATS,
  expectedDaysInRange,
  lateThresholdMinutes,
  loadShiftStats,
} from "@/utils/attendance/arrivals";
import { buildLeaveLedger, countNotIn, emptyLeaveLedgerEntry } from "@/utils/leave/leaveLedger";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const rate = (part: number, whole: number, dp = 0) => (whole > 0 ? round((part / whole) * 100, dp) : 0);

/**
 * Per-employee productivity + attendance, derived in one pipeline:
 * shifts/visits/moms are joined filtered to the range, then hours/days computed.
 *
 * Adherence metrics (`attendanceRate`, `punctualityRate`, `leaveDays`) are merged
 * in afterwards from the shared attendance and leave utilities rather than being
 * re-derived here, so this endpoint, the attendance report and the salary report
 * agree. They are what the performance radar ranks on, alongside raw output —
 * which is the point: someone who produces a lot but never shows up on time
 * should not top the leaderboard.
 *
 * Cohort stays EMPLOYEE-only: this feeds the "top/bottom employees" ranking, and
 * admins/warehouse staff (who record no shifts) would distort it.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const settings = await getSettings();
    const lateThreshold = lateThresholdMinutes(settings);
    const excludedIds = await getExcludedUserIds();

    // Kicked off before the (much heavier) aggregate so all three run concurrently.
    const shiftStatsPromise = loadShiftStats(from, to);
    const leaveLedgerPromise = buildLeaveLedger(from, to);

    // The correlated sub-pipelines below need no exclusion of their own — the
    // excluded accounts are already gone from the cohort this $match produces.
    const data = await User.aggregate([
      { $match: { role: userRoles.EMPLOYEE, isActive: true, ...excludeUsers("_id", excludedIds) } },
      {
        $lookup: {
          from: "shifts",
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$uid"] }, startTime: { $gte: from, $lt: to } } },
          ],
          as: "rangeShifts",
        },
      },
      {
        $lookup: {
          from: "shifts",
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$uid"] }, status: shiftStatus.IN_PROGRESS } },
          ],
          as: "openShifts",
        },
      },
      {
        $lookup: {
          from: "visits",
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$createdBy", "$$uid"] }, isActive: true, createdAt: { $gte: from, $lt: to } } },
          ],
          as: "rangeVisits",
        },
      },
      {
        $lookup: {
          from: "moms",
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$createdBy", "$$uid"] }, isActive: true, createdAt: { $gte: from, $lt: to } } },
          ],
          as: "rangeMoms",
        },
      },
      {
        $project: {
          _id: 0,
          id: "$_id",
          createdAt: 1,
          name: {
            $trim: {
              input: { $concat: [{ $ifNull: ["$firstName", ""] }, " ", { $ifNull: ["$lastName", ""] }] },
            },
          },
          email: { $ifNull: ["$email", ""] },
          isOnShift: { $ifNull: ["$isOnShift", false] },
          visits: { $size: "$rangeVisits" },
          moms: { $size: "$rangeMoms" },
          shiftsCount: { $size: "$rangeShifts" },
          totalHours: {
            $round: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$rangeShifts",
                        as: "s",
                        cond: { $and: [{ $eq: ["$$s.status", shiftStatus.ENDED] }, { $ne: ["$$s.endTime", null] }] },
                      },
                    },
                    as: "s",
                    in: { $max: [0, { $divide: [{ $subtract: ["$$s.endTime", "$$s.startTime"] }, 3600000] }] },
                  },
                },
              },
              1,
            ],
          },
          workingDays: {
            $size: {
              $setUnion: [
                {
                  $map: {
                    input: "$rangeShifts",
                    as: "s",
                    in: { $dateTrunc: { date: "$$s.startTime", unit: "day", timezone: TIMEZONE } },
                  },
                },
                [],
              ],
            },
          },
          avgMomsPerShift: {
            $cond: [
              { $gt: [{ $size: "$rangeShifts" }, 0] },
              { $round: [{ $divide: [{ $size: "$rangeMoms" }, { $size: "$rangeShifts" }] }, 1] },
              0,
            ],
          },
          hasOpenShift: { $gt: [{ $size: "$openShifts" }, 0] },
          lastShiftStart: { $max: "$rangeShifts.startTime" },
          signatureRate: {
            $let: {
              vars: {
                signedCount: {
                  $size: {
                    $filter: {
                      input: "$rangeMoms",
                      as: "m",
                      cond: { $and: [{ $ne: ["$$m.signature", ""] }, { $ne: ["$$m.signature", null] }] },
                    },
                  },
                },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: "$rangeMoms" }, 0] },
                  { $round: [{ $multiply: [{ $divide: ["$$signedCount", { $size: "$rangeMoms" }] }, 100] }, 0] },
                  0,
                ],
              },
            },
          },
          // Total app installs the employee registered (sum across their moms),
          // and how many of their moms installed at least one app.
          appInstalls: {
            $sum: {
              $map: {
                input: "$rangeMoms",
                as: "m",
                in: { $size: { $ifNull: ["$$m.installedApp", []] } },
              },
            },
          },
          momsWithApp: {
            $size: {
              $filter: {
                input: "$rangeMoms",
                as: "m",
                cond: { $gt: [{ $size: { $ifNull: ["$$m.installedApp", []] } }, 0] },
              },
            },
          },
          // Boxes/products the employee distributed = sum of survey entries
          // across their moms (one survey entry = one box handed out).
          productsDistributed: {
            $sum: {
              $map: {
                input: "$rangeMoms",
                as: "m",
                in: { $size: { $ifNull: ["$$m.survey", []] } },
              },
            },
          },
        },
      },
      {
        $addFields: {
          momsPerHour: {
            $cond: [{ $gt: ["$totalHours", 0] }, { $round: [{ $divide: ["$moms", "$totalHours"] }, 1] }, 0],
          },
        },
      },
      { $sort: { moms: -1 } },
    ]);

    // Merge in the adherence metrics the performance radar ranks on.
    const shiftStats = await shiftStatsPromise;
    const leaveLedger = await leaveLedgerPromise;

    for (const row of data as any[]) {
      const uid = String(row.id);
      const stats = shiftStats.get(uid) ?? EMPTY_SHIFT_STATS;
      const leave = leaveLedger.get(uid) ?? emptyLeaveLedgerEntry();

      const attendedDayKeys = new Set(stats.earliestByDay.keys());
      const attendedDays = attendedDayKeys.size;

      // Authorised absence — paid or unpaid — comes out of the denominator: an
      // employee shouldn't rank lower for days they had permission to miss.
      const leaveDays =
        countNotIn(leave.paidLeaveDayKeys, attendedDayKeys) +
        countNotIn(leave.unpaidLeaveDayKeys, attendedDayKeys);
      const expectedDays = expectedDaysInRange(from, to, row.createdAt, settings);
      const adherenceBase = Math.max(0, expectedDays - leaveDays);

      // Lateness on a day covered by an approved delay permit doesn't count.
      let lateDays = 0;
      for (const [dayKey, arrival] of stats.earliestByDay) {
        if (arrival <= lateThreshold) continue;
        if (arrival > lateThreshold + (leave.delayMinutesByDay.get(dayKey) ?? 0)) lateDays++;
      }

      row.leaveDays = leaveDays;
      row.attendanceRate = adherenceBase > 0 ? Math.min(100, rate(attendedDays, adherenceBase)) : 0;
      // Guarded so someone who never showed up scores 0 rather than a perfect
      // 100 for "0 late days out of 0".
      row.punctualityRate = attendedDays > 0 ? Math.max(0, 100 - rate(lateDays, attendedDays)) : 0;
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute employees report" }, { status: 500 });
  }
}
