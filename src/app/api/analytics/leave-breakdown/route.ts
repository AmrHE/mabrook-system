/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import {
  parseRange,
  parseGranularity,
  bucketKeyForDay,
  riyadhDayKey,
  riyadhDayStartISO,
} from "@/utils/date/range";
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus, leaveType } from "@/models/enum.constants";
import { buildLeaveLedger } from "@/utils/leave/leaveLedger";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { LEAVE_STATUS_AR, LEAVE_TYPE_AR } from "@/utils/leave/labels";

export const dynamic = "force-dynamic";

/**
 * Leave activity for the analytics dashboard: headline totals, composition by
 * type and status, and days off over time.
 *
 * Day-based numbers come from the shared leave ledger (so they match the reports
 * exactly, including span clipping at the window edges); request-based counts and
 * decision latency come from a small aggregate over the same window.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const unit = parseGranularity(req.nextUrl.searchParams);
    const fromKey = riyadhDayKey(from);
    const toKey = riyadhDayKey(new Date(Math.max(from.getTime(), to.getTime() - 1)));
    // The ledger applies the same exclusion internally.
    const byRequester = excludeUsers("userId", await getExcludedUserIds());

    const [ledger, statusAgg, typeRequestAgg, decisionAgg] = await Promise.all([
      buildLeaveLedger(from, to),
      LeaveRequest.aggregate([
        { $match: { isActive: true, endDay: { $gte: fromKey }, startDay: { $lte: toKey }, ...byRequester } },
        { $group: { _id: "$status", requests: { $sum: 1 } } },
      ]),
      LeaveRequest.aggregate([
        {
          $match: {
            isActive: true,
            status: leaveStatus.APPROVED,
            endDay: { $gte: fromKey },
            startDay: { $lte: toKey },
            ...byRequester,
          },
        },
        { $group: { _id: "$type", requests: { $sum: 1 } } },
      ]),
      LeaveRequest.aggregate([
        {
          $match: {
            isActive: true,
            decidedAt: { $ne: null },
            endDay: { $gte: fromKey },
            startDay: { $lte: toKey },
            ...byRequester,
          },
        },
        {
          $group: {
            _id: null,
            avgHours: { $avg: { $divide: [{ $subtract: ["$decidedAt", "$createdAt"] }, 3600000] } },
            decided: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Headline totals, aggregated across users from the ledger.
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let delayPermitDays = 0;
    let earlyLeaveDays = 0;
    let excusedMinutes = 0;
    let pendingRequests = 0;
    const employeesOnLeave = new Set<string>();

    // Days off over time, bucketed like every other timeseries in the dashboard.
    const buckets = new Map<string, { leaveDays: number; permits: number }>();
    const bucketFor = (dayKey: string) => {
      const key = riyadhDayStartISO(bucketKeyForDay(dayKey, unit));
      let b = buckets.get(key);
      if (!b) {
        b = { leaveDays: 0, permits: 0 };
        buckets.set(key, b);
      }
      return b;
    };

    for (const [uid, entry] of ledger) {
      paidLeaveDays += entry.paidLeaveDayKeys.size;
      unpaidLeaveDays += entry.unpaidLeaveDayKeys.size;
      delayPermitDays += entry.delayPermitDays;
      earlyLeaveDays += entry.earlyLeaveDays;
      excusedMinutes += entry.excusedMinutes;
      pendingRequests += entry.pendingRequests;

      if (entry.paidLeaveDayKeys.size > 0 || entry.unpaidLeaveDayKeys.size > 0) employeesOnLeave.add(uid);

      for (const day of entry.paidLeaveDayKeys) bucketFor(day).leaveDays++;
      for (const day of entry.unpaidLeaveDayKeys) bucketFor(day).leaveDays++;
      for (const day of entry.delayMinutesByDay.keys()) bucketFor(day).permits++;
      for (const day of entry.earlyMinutesByDay.keys()) bucketFor(day).permits++;
    }

    const timeseries = [...buckets.entries()]
      .map(([date, b]) => ({ date, ...b }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Composition by type, split paid vs unpaid so the cost is visible at a glance.
    // Day counts come from the ledger (window-clipped) so this chart always sums to
    // the totals above; only the request counts come from the aggregate.
    const typeRows = Object.values(leaveType).map((t) => ({
      type: t,
      name: LEAVE_TYPE_AR[t] ?? t,
      paidDays: 0,
      unpaidDays: 0,
      requests: (typeRequestAgg as any[]).find((g) => g._id === t)?.requests ?? 0,
    }));
    const typeIndex = new Map(typeRows.map((r) => [r.type as string, r]));
    for (const entry of ledger.values()) {
      for (const [type, days] of Object.entries(entry.paidDaysByType)) {
        const row = typeIndex.get(type);
        if (row) row.paidDays += days;
      }
      for (const [type, days] of Object.entries(entry.unpaidDaysByType)) {
        const row = typeIndex.get(type);
        if (row) row.unpaidDays += days;
      }
    }

    const statusRows = Object.values(leaveStatus).map((s) => {
      const found = (statusAgg as any[]).find((g) => g._id === s);
      return { status: s, name: LEAVE_STATUS_AR[s] ?? s, requests: found?.requests ?? 0 };
    });

    const decision = (decisionAgg as any[])[0];

    return NextResponse.json(
      {
        summary: {
          paidLeaveDays,
          unpaidLeaveDays,
          totalLeaveDays: paidLeaveDays + unpaidLeaveDays,
          delayPermitDays,
          earlyLeaveDays,
          excusedHours: Math.round((excusedMinutes / 60) * 10) / 10,
          pendingRequests,
          employeesOnLeave: employeesOnLeave.size,
          avgDecisionHours: decision?.avgHours != null ? Math.round(decision.avgHours * 10) / 10 : null,
          decidedRequests: decision?.decided ?? 0,
        },
        byType: typeRows,
        byStatus: statusRows,
        timeseries,
        granularity: unit,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "Failed to compute leave breakdown" },
      { status: 500 },
    );
  }
}
