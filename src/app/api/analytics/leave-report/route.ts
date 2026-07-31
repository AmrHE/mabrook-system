/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { User } from "@/models/User";
import { getSettings } from "@/utils/settings/getSettings";
import { EMPTY_SHIFT_STATS, expectedDaysInRange, loadShiftStats } from "@/utils/attendance/arrivals";
import { buildLeaveLedger, emptyLeaveLedgerEntry } from "@/utils/leave/leaveLedger";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { computeLeavePayroll } from "@/utils/leave/payroll";
import { userRoleLabel } from "@/utils/user/roleLabels";

export const dynamic = "force-dynamic";

/**
 * Per-user leave consumption over the range, with what each decision cost.
 *
 * The money comes from the same `computeLeavePayroll` the salary report uses, so
 * `unpaidLeaveDeduction + permitDeduction + unexcusedAbsenceDeduction` reconciles
 * exactly against that report's `deduction` column for the same period. This tab
 * exists so an admin can see the cost of their own paid/unpaid calls without
 * cross-reading the payroll table.
 *
 * Rows with no leave activity at all are dropped — this is a leave report, not a
 * roster.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const settings = await getSettings();

    const [employees, shiftStats, leaveLedger] = await Promise.all([
      User.find({ isActive: true, ...excludeUsers("_id", await getExcludedUserIds()) })
        .select("firstName lastName email role createdAt salary project")
        .lean(),
      loadShiftStats(from, to),
      buildLeaveLedger(from, to),
    ]);

    const data = (employees as any[])
      .map((emp) => {
        const uid = String(emp._id);
        const leave = leaveLedger.get(uid) ?? emptyLeaveLedgerEntry();
        const stats = shiftStats.get(uid) ?? EMPTY_SHIFT_STATS;
        const attendedDayKeys = new Set(stats.earliestByDay.keys());
        const expectedDays = expectedDaysInRange(from, to, emp.createdAt, settings);
        const pay = computeLeavePayroll({
          salary: emp.salary ?? 0,
          expectedDays,
          attendedDayKeys,
          leave,
        });

        return {
          id: uid,
          name: `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "غير محدد",
          role: userRoleLabel(emp.role),
          project: emp.project ?? "",
          paidLeaveDays: pay.paidLeaveDays,
          unpaidLeaveDays: pay.unpaidLeaveDays,
          totalLeaveDays: pay.paidLeaveDays + pay.unpaidLeaveDays,
          delayPermitDays: leave.delayPermitDays,
          earlyLeaveDays: leave.earlyLeaveDays,
          unpaidPermitDays: pay.unpaidPermitDays,
          excusedMinutes: leave.excusedMinutes,
          approvedRequests: leave.approvedRequests,
          pendingRequests: leave.pendingRequests,
          pendingDays: leave.pendingDays,
          rejectedRequests: leave.rejectedRequests,
          unpaidLeaveDeduction: pay.unpaidLeaveDeduction,
          permitDeduction: pay.permitDeduction,
          leaveDeduction: Math.round((pay.unpaidLeaveDeduction + pay.permitDeduction) * 100) / 100,
          unexcusedAbsenceDeduction: pay.unexcusedAbsenceDeduction,
          deduction: pay.deduction,
        };
      })
      .filter(
        (r) =>
          r.totalLeaveDays > 0 ||
          r.delayPermitDays > 0 ||
          r.earlyLeaveDays > 0 ||
          r.pendingRequests > 0 ||
          r.rejectedRequests > 0,
      );

    data.sort(
      (a, b) =>
        b.totalLeaveDays - a.totalLeaveDays ||
        b.leaveDeduction - a.leaveDeduction ||
        a.name.localeCompare(b.name, "ar"),
    );

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "Failed to compute leave report" },
      { status: 500 },
    );
  }
}
