/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, riyadhDayKey, TIMEZONE } from "@/utils/date/range";
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus } from "@/models/enum.constants";
import { formatPermitMinutes, leavePayModeLabel, leaveStatusLabel, leaveTypeLabel } from "@/utils/leave/labels";
import { userRoleLabel } from "@/utils/user/roleLabels";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * One flattened, Arabic-localised row per leave request, for the report table and
 * its CSV. Pre-formatted server-side like the other `*-rows` endpoints so the CSV
 * writer stays dumb.
 *
 * Selected by *day span* overlapping the window rather than by `createdAt`: a
 * report for July should show the July days off, whenever the request was filed.
 * Cancelled requests are included here (unlike in the ledger) because this is the
 * audit trail, not the payroll input.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const fromKey = riyadhDayKey(from);
    const toKey = riyadhDayKey(new Date(Math.max(from.getTime(), to.getTime() - 1)));

    const docs = await LeaveRequest.find({
      isActive: true,
      endDay: { $gte: fromKey },
      startDay: { $lte: toKey },
      ...excludeUsers("userId", await getExcludedUserIds()),
    })
      .populate({ path: "userId", select: "firstName lastName email role project" })
      .populate({ path: "decidedBy", select: "firstName lastName" })
      .sort({ startDay: -1, createdAt: -1 })
      .lean();

    const fullName = (u: any) =>
      u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "غير محدد" : "";

    const rows = (docs as any[]).map((d) => ({
      employee: fullName(d.userId),
      email: d.userId?.email ?? "",
      role: userRoleLabel(d.userId?.role),
      project: d.userId?.project ?? "",
      type: leaveTypeLabel(d.type),
      startDay: d.startDay ?? "",
      endDay: d.endDay ?? "",
      daysCount: d.daysCount ?? 1,
      duration: formatPermitMinutes(d.minutes),
      status: leaveStatusLabel(d.status),
      // A pay mode only ever exists on an approval; blank elsewhere so the column
      // doesn't imply a decision that was never made.
      payMode: d.status === leaveStatus.APPROVED ? leavePayModeLabel(d.payMode) : "—",
      reason: d.reason ?? "",
      decidedByName: fullName(d.decidedBy),
      decisionNote: d.decisionNote ?? "",
      decidedAt: d.decidedAt
        ? new Date(d.decidedAt).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" })
        : "",
      createdAt: d.createdAt
        ? new Date(d.createdAt).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" })
        : "",
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute leave rows" }, { status: 500 });
  }
}
