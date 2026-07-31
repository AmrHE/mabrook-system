/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { User } from "@/models/User";
import { getSettings } from "@/utils/settings/getSettings";
import {
  EMPTY_SHIFT_STATS,
  expectedDaysInRange,
  lateThresholdMinutes,
  loadShiftStats,
} from "@/utils/attendance/arrivals";
import { buildLeaveLedger, emptyLeaveLedgerEntry } from "@/utils/leave/leaveLedger";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { computeLeavePayroll } from "@/utils/leave/payroll";
import { userRoleLabel } from "@/utils/user/roleLabels";

export const dynamic = "force-dynamic";

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const rate = (part: number, whole: number, dp = 0) => (whole > 0 ? round((part / whole) * 100, dp) : 0);

/**
 * Per-employee monthly salary/payroll report over the selected range.
 *
 * Attendance (attendedDays, expectedDays, lateDays) is measured exactly like the
 * attendance report — earliest arrival per local day vs. the org-wide schedule in
 * Settings, with expected days prorated over the range and clipped to the join date.
 *
 * The money itself is computed by `computeLeavePayroll` (src/utils/leave/payroll.ts),
 * which documents the business rules and is shared with the leave report so the
 * deduction and its attribution can never disagree. In short: a no-show and an
 * approved UNPAID full-day leave each cost one day, an approved UNPAID permit
 * costs a flat quarter day, and anything approved as PAID costs nothing.
 *
 * Late arrivals carry no monetary penalty of their own — they are reported as a
 * count, and an approved delay permit excuses them from that count.
 *
 * Cohort: every active user, not just EMPLOYEEs — admins and warehouse staff draw
 * salaries and may request leave too. Note they typically record no shifts, so
 * their rows show zero attended days; filter by role in the report UI.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const settings = await getSettings();
    const lateThreshold = lateThresholdMinutes(settings);

    const [employees, shiftStats, leaveLedger] = await Promise.all([
      User.find({ isActive: true, ...excludeUsers("_id", await getExcludedUserIds()) })
        .select("firstName lastName email role createdAt salary iban bankName project")
        .lean(),
      loadShiftStats(from, to),
      buildLeaveLedger(from, to),
    ]);

    const nowMs = to.getTime();
    const data = (employees as any[])
      // Drop employees hired after the selected period — they didn't exist yet,
      // so a row of zeros would be misleading. Mid-period hires stay (prorated).
      .filter((emp) => (emp.createdAt ? new Date(emp.createdAt).getTime() : 0) < nowMs)
      .map((emp) => {
        const uid = String(emp._id);
        const stats = shiftStats.get(uid) ?? EMPTY_SHIFT_STATS;
        const leave = leaveLedger.get(uid) ?? emptyLeaveLedgerEntry();

        // Per-day earliest arrival → attendance & lateness. An approved delay
        // permit pushes that day's threshold out by the permitted minutes.
        const attendedDayKeys = new Set(stats.earliestByDay.keys());
        let lateDays = 0;
        let excusedLateDays = 0;
        for (const [dayKey, arrival] of stats.earliestByDay) {
          if (arrival <= lateThreshold) continue;
          const allowance = leave.delayMinutesByDay.get(dayKey) ?? 0;
          if (arrival > lateThreshold + allowance) lateDays++;
          else excusedLateDays++;
        }

        // Expected days in range, window clipped by the employee's join date.
        const expectedDays = expectedDaysInRange(from, to, emp.createdAt, settings);

        const salary = emp.salary ?? 0;
        const pay = computeLeavePayroll({ salary, expectedDays, attendedDayKeys, leave });

        return {
          id: uid,
          name: `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "غير محدد",
          role: userRoleLabel(emp.role),
          salary,
          attendedDays: pay.attendedDays,
          expectedDays: pay.expectedDays,
          absentDays: pay.absentDays,
          unexcusedAbsentDays: pay.unexcusedAbsentDays,
          paidLeaveDays: pay.paidLeaveDays,
          unpaidLeaveDays: pay.unpaidLeaveDays,
          delayPermitDays: leave.delayPermitDays,
          earlyLeaveDays: leave.earlyLeaveDays,
          unpaidPermitDays: pay.unpaidPermitDays,
          lateDays,
          excusedLateDays,
          // Paid share of the period (== 1 - absentDays/expectedDays), so it always
          // agrees with the deduction on the same row. The attendance report's
          // like-named field is an *adherence* measure and is computed differently.
          attendanceRate: expectedDays > 0 ? Math.min(100, rate(pay.coveredDays, expectedDays)) : 0,
          dailyRate: pay.dailyRate,
          permitDeduction: pay.permitDeduction,
          deduction: pay.deduction,
          netSalary: pay.netSalary,
          iban: emp.iban ?? "",
          bankName: emp.bankName ?? "",
          project: emp.project ?? "",
        };
      });

    data.sort((a, b) => b.netSalary - a.netSalary || a.name.localeCompare(b.name, "ar"));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute salary report" }, { status: 500 });
  }
}
