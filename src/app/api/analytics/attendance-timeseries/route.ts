/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import {
  parseRange,
  parseGranularity,
  bucketKeyForDay,
  riyadhDayStartISO,
  TIMEZONE,
} from "@/utils/date/range";
import { Visit } from "@/models/Visit";
import { Mom } from "@/models/Mom";
import { getSettings } from "@/utils/settings/getSettings";
import { lateThresholdMinutes, loadShiftStats } from "@/utils/attendance/arrivals";
import { allLeaveDayKeys, buildLeaveLedger } from "@/utils/leave/leaveLedger";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

interface Bucket {
  users: Set<string>;
  /** Employee-days in this bucket (one per day-shift). */
  shifts: number;
  /** Σ check-in → check-out pairs across those days. */
  sessions: number;
  onTime: number;
  lateCount: number;
  excusedLateCount: number;
  totalHours: number;
  autoClosedCount: number;
  onLeaveUsers: Set<string>;
  leaveDays: number;
}

const emptyBucket = (): Bucket => ({
  users: new Set(),
  shifts: 0,
  sessions: 0,
  onTime: 0,
  lateCount: 0,
  excusedLateCount: 0,
  totalHours: 0,
  autoClosedCount: 0,
  onLeaveUsers: new Set(),
  leaveDays: 0,
});

/**
 * Attendance over time (day/week/month): presence, punctuality, hours, output,
 * and how much of any dip is explained by approved leave.
 *
 * Shifts are bucketed in JS rather than by `$dateTrunc` because excusing lateness
 * needs each shift's own day matched against that employee's approved delay
 * permits — a per-document join the pipeline can't do cheaply. Buckets are still
 * keyed by the instant `$dateTrunc` would have produced, so the response contract
 * (and the Visit/Mom pipelines below) are unchanged.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const unit = parseGranularity(req.nextUrl.searchParams);
    const settings = await getSettings();
    const lateThreshold = lateThresholdMinutes(settings);
    const truncCreated = { $dateTrunc: { date: "$createdAt", unit, timezone: TIMEZONE } };
    // The shift/leave helpers apply the same exclusion internally.
    const byEmployee = excludeUsers("createdBy", await getExcludedUserIds());

    const [shiftStats, leaveLedger, visitBuckets, momBuckets] = await Promise.all([
      loadShiftStats(from, to),
      buildLeaveLedger(from, to),
      Visit.aggregate([
        { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee } },
        { $group: { _id: truncCreated, count: { $sum: 1 } } },
      ]),
      Mom.aggregate([
        { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee } },
        { $group: { _id: truncCreated, count: { $sum: 1 } } },
      ]),
    ]);

    const buckets = new Map<string, Bucket>();
    const bucketFor = (dayKey: string): Bucket => {
      const key = riyadhDayStartISO(bucketKeyForDay(dayKey, unit));
      let b = buckets.get(key);
      if (!b) {
        b = emptyBucket();
        buckets.set(key, b);
      }
      return b;
    };

    for (const [uid, stats] of shiftStats) {
      const leave = leaveLedger.get(uid);
      for (const s of stats.shifts) {
        const b = bucketFor(s.dayKey);
        b.users.add(uid);
        // One vote per employee-DAY. Before shifts collapsed by day, an employee
        // who checked in three times cast three punctuality votes and skewed the
        // on-time rate against themselves.
        b.shifts++;
        b.sessions += s.sessions;
        b.totalHours += Math.max(0, s.durH);
        b.autoClosedCount += s.autoClosedSessions;

        if (s.localMin <= lateThreshold) {
          b.onTime++;
        } else {
          const allowance = leave?.delayMinutesByDay.get(s.dayKey) ?? 0;
          if (s.localMin > lateThreshold + allowance) b.lateCount++;
          else b.excusedLateCount++;
        }
      }
    }

    // Approved full-day leave, so a drop in `presentEmployees` can be read
    // against how many people were legitimately off that period.
    for (const [uid, leave] of leaveLedger) {
      for (const dayKey of allLeaveDayKeys(leave)) {
        const b = bucketFor(dayKey);
        b.onLeaveUsers.add(uid);
        b.leaveDays++;
      }
    }

    const visitMap = new Map<string, number>(visitBuckets.map((b: any) => [new Date(b._id).toISOString(), b.count]));
    const momMap = new Map<string, number>(momBuckets.map((b: any) => [new Date(b._id).toISOString(), b.count]));

    const data = [...buckets.entries()]
      .map(([key, b]) => ({
        date: key,
        presentEmployees: b.users.size,
        shifts: b.shifts,
        sessions: b.sessions,
        lateCount: b.lateCount,
        excusedLateCount: b.excusedLateCount,
        // An excused-late shift counts as on time here: the employee had permission.
        onTimeRate: b.shifts > 0 ? Math.round(((b.onTime + b.excusedLateCount) / b.shifts) * 100) : 0,
        totalHours: Math.round(b.totalHours * 10) / 10,
        autoClosedCount: b.autoClosedCount,
        onLeaveEmployees: b.onLeaveUsers.size,
        leaveDays: b.leaveDays,
        visits: visitMap.get(key) ?? 0,
        moms: momMap.get(key) ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ data, granularity: unit }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute attendance timeseries" }, { status: 500 });
  }
}
