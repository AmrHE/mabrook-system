/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { shiftCloseReason } from "@/models/enum.constants";
import { User } from "@/models/User";
import { Visit } from "@/models/Visit";
import { Mom } from "@/models/Mom";
import { getSettings } from "@/utils/settings/getSettings";
import {
  EMPTY_SHIFT_STATS,
  expectedDaysInRange,
  lateThresholdMinutes,
  loadShiftStats,
  minutesToHHMM,
} from "@/utils/attendance/arrivals";
import { buildLeaveLedger, emptyLeaveLedgerEntry, countNotIn } from "@/utils/leave/leaveLedger";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { userRoleLabel } from "@/utils/user/roleLabels";

export const dynamic = "force-dynamic";

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const rate = (part: number, whole: number, dp = 0) => (whole > 0 ? round((part / whole) * 100, dp) : 0);

/**
 * Per-employee attendance + adherence + performance over the range, measured
 * against the org-wide schedule in Settings (flexible check-in window + target hours).
 *
 * This is the *adherence* view, deliberately different from the salary report's
 * *money* view: any authorised absence — paid or unpaid — is removed from the
 * denominator, because the employee did have permission to be away. The salary
 * report only forgives the paid ones. Both read the same leave ledger, so the two
 * can be reconciled, but they answer different questions.
 *
 * Approved permits are honoured too: a delay permit pushes that day's late
 * threshold out by its minutes, and every permit's minutes come off the expected
 * hours for the period.
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
    const byEmployee = excludeUsers("createdBy", excludedIds);

    const [employees, shiftStats, leaveLedger, visitCounts, momCounts] = await Promise.all([
      User.find({ isActive: true, ...excludeUsers("_id", excludedIds) })
        .select("firstName lastName email role isOnShift createdAt")
        .lean(),
      loadShiftStats(from, to),
      buildLeaveLedger(from, to),
      Visit.aggregate([
        { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee } },
        { $group: { _id: "$createdBy", count: { $sum: 1 } } },
      ]),
      Mom.aggregate([
        { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee } },
        { $group: { _id: "$createdBy", count: { $sum: 1 } } },
      ]),
    ]);

    const visitMap = new Map<string, number>(visitCounts.map((v: any) => [String(v._id), v.count]));
    const momMap = new Map<string, number>(momCounts.map((m: any) => [String(m._id), m.count]));

    const data = (employees as any[]).map((emp) => {
      const uid = String(emp._id);
      const stats = shiftStats.get(uid) ?? EMPTY_SHIFT_STATS;
      const leave = leaveLedger.get(uid) ?? emptyLeaveLedgerEntry();
      const list = stats.shifts;

      // Per-day earliest arrival → attendance & lateness. Lateness on a day with
      // an approved delay permit is excused up to the permitted minutes.
      const attendedDayKeys = new Set(stats.earliestByDay.keys());
      const attendedDays = attendedDayKeys.size;
      let lateDays = 0;
      let excusedLateDays = 0;
      let arrivalSum = 0;
      for (const [dayKey, arrival] of stats.earliestByDay) {
        arrivalSum += arrival;
        if (arrival <= lateThreshold) continue;
        const allowance = leave.delayMinutesByDay.get(dayKey) ?? 0;
        if (arrival > lateThreshold + allowance) lateDays++;
        else excusedLateDays++;
      }

      // Per-shift aggregates.
      const shiftsCount = list.length;
      let totalHours = 0;
      let endedShifts = 0;
      let autoClosedShifts = 0;
      let forgotShifts = 0;
      for (const s of list) {
        if (s.durH != null) {
          totalHours += Math.max(0, s.durH);
          endedShifts++;
        }
        if (s.autoClosed) autoClosedShifts++;
        if (
          s.autoClosed &&
          (s.closeReason === shiftCloseReason.MAX_DURATION || s.closeReason === shiftCloseReason.INACTIVITY)
        ) {
          forgotShifts++;
        }
      }

      // Expected days in range, window clipped by the employee's join date.
      const expectedDays = expectedDaysInRange(from, to, emp.createdAt, settings);

      // Authorised absence, de-duplicated against days actually worked, comes out
      // of the denominator: you can't be marked down for a day you had off.
      const paidLeaveDays = countNotIn(leave.paidLeaveDayKeys, attendedDayKeys);
      const unpaidLeaveDays = countNotIn(leave.unpaidLeaveDayKeys, attendedDayKeys);
      const leaveDays = paidLeaveDays + unpaidLeaveDays;
      const adherenceBase = Math.max(0, expectedDays - leaveDays);
      // Approved permit minutes shorten the day, so they shorten the hours target.
      const expectedHours = Math.max(0, round(adherenceBase * settings.expectedHoursPerDay - leave.excusedMinutes / 60, 1));

      const visits = visitMap.get(uid) ?? 0;
      const moms = momMap.get(uid) ?? 0;

      return {
        id: uid,
        name: `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "غير محدد",
        email: emp.email ?? "",
        role: userRoleLabel(emp.role),
        isOnShift: !!emp.isOnShift,
        shiftsCount,
        attendedDays,
        expectedDays,
        adherenceBase,
        attendanceRate: adherenceBase > 0 ? Math.min(100, rate(attendedDays, adherenceBase)) : 0,
        leaveDays,
        paidLeaveDays,
        unpaidLeaveDays,
        delayPermitDays: leave.delayPermitDays,
        earlyLeaveDays: leave.earlyLeaveDays,
        excusedMinutes: leave.excusedMinutes,
        pendingRequests: leave.pendingRequests,
        lateDays,
        excusedLateDays,
        lateRate: rate(lateDays, attendedDays),
        avgStartTime: attendedDays > 0 ? minutesToHHMM(arrivalSum / attendedDays) : "—",
        totalHours: round(totalHours, 1),
        expectedHours,
        hoursMetRate: rate(totalHours, expectedHours),
        avgHoursPerShift: endedShifts > 0 ? round(totalHours / endedShifts, 1) : 0,
        visits,
        moms,
        avgVisitsPerShift: shiftsCount > 0 ? round(visits / shiftsCount, 1) : 0,
        avgMomsPerShift: shiftsCount > 0 ? round(moms / shiftsCount, 1) : 0,
        autoClosedShifts,
        autoClosedRate: rate(autoClosedShifts, shiftsCount),
        forgotToEndRate: rate(forgotShifts, shiftsCount),
      };
    });

    data.sort((a, b) => b.attendanceRate - a.attendanceRate || b.moms - a.moms);

    return NextResponse.json({ data, settings }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute attendance report" }, { status: 500 });
  }
}
