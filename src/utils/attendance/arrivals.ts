/* eslint-disable @typescript-eslint/no-explicit-any */
import { Shift } from "@/models/Shift";
import { shiftStatus } from "@/models/enum.constants";
import { TIMEZONE } from "@/utils/date/range";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { FORGOT_CLOSE_REASONS } from "@/utils/shift/labels";
import type { AttendanceSettings } from "@/utils/settings/getSettings";

/**
 * Shared attendance primitive.
 *
 * There is no Attendance collection — presence is derived from `Shift` documents
 * at read time: one Riyadh calendar day with at least one shift counts as one
 * attended day, and that day's *earliest* check-in decides punctuality. This
 * aggregation used to be copy-pasted between the salary report, the attendance
 * report and the employees report; it lives here so the three can never drift.
 *
 * Since shifts collapse to one document per employee per day, a `ProjectedShift`
 * IS an attended day, and the per-check-in detail lives in its session counts.
 * `earliestByDay` is unchanged by that collapse — the survivor of a merge is
 * always the day's earliest check-in — which is why punctuality and the salary
 * report produce identical numbers before and after.
 *
 * Days are keyed as `YYYY-MM-DD` (Riyadh) rather than truncated Date instants so
 * they can be intersected directly with leave-request day spans — see
 * `src/utils/leave/leaveLedger.ts`.
 */

export interface ProjectedShift {
  /** Riyadh calendar day of the check-in, `YYYY-MM-DD`. */
  dayKey: string;
  /** Check-in as minutes past local midnight, for lateness comparisons. */
  localMin: number;
  /**
   * Worked hours for the day — the sum of its closed sessions.
   *
   * Never null now. Before shifts collapsed by day this was null while a shift
   * was open, because an unfinished span has no duration; a day-shift can
   * report the sessions it has already closed even while another is running.
   */
  durH: number;
  /** True while a session of this day is still running. */
  open: boolean;
  /** Number of check-in → check-out sessions in the day. */
  sessions: number;
  /** Sessions the system had to close on the employee's behalf. */
  autoClosedSessions: number;
  /** Sessions closed by max-duration / inactivity / day-rollover. */
  forgotSessions: number;
  /** How the DAY finally ended (the last closed session's outcome). */
  autoClosed: boolean;
  closeReason?: string;
}

export interface UserShiftStats {
  shifts: ProjectedShift[];
  /** dayKey → earliest check-in that day (minutes past local midnight). */
  earliestByDay: Map<string, number>;
}

/** Minute-of-day past which an arrival counts as late. */
export function lateThresholdMinutes(settings: AttendanceSettings): number {
  return toMinutes(settings.expectedStartTo) + settings.graceMinutes;
}

/** `"HH:MM"` → minutes past midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Minutes past midnight → `"HH:MM"`. */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Load every shift started in `[from, to)`, projected and grouped by user, with
 * each day's earliest arrival pre-computed.
 *
 * Internal/test accounts are dropped here rather than at each call site: every
 * caller is an analytics or report endpoint, and several iterate the returned
 * Map directly (see the attendance timeseries) rather than driving from a User
 * cohort, so filtering only the cohort would leave them counted.
 */
export async function loadShiftStats(from: Date, to: Date): Promise<Map<string, UserShiftStats>> {
  const excludedIds = await getExcludedUserIds();

  const rows = await Shift.aggregate([
    { $match: { startTime: { $gte: from, $lt: to }, ...excludeUsers("userId", excludedIds) } },
    {
      $project: {
        userId: 1,
        autoClosed: 1,
        closeReason: 1,
        localMin: {
          $add: [
            { $multiply: [{ $hour: { date: "$startTime", timezone: TIMEZONE } }, 60] },
            { $minute: { date: "$startTime", timezone: TIMEZONE } },
          ],
        },
        // Prefer the stored dayKey; derive it for rows the backfill hasn't
        // reached yet. Both produce the same string for the same instant.
        dayKey: {
          $ifNull: [
            "$dayKey",
            { $dateToString: { date: "$startTime", format: "%Y-%m-%d", timezone: TIMEZONE } },
          ],
        },
        open: { $eq: ["$status", shiftStatus.IN_PROGRESS] },
        sessions: { $max: [1, { $size: { $ifNull: ["$segments", []] } }] },
        /**
         * Worked hours = summed sessions. The old `endTime - startTime` would
         * now span the whole day including the breaks between sessions, which
         * inflates a split day by hours. Legacy rows have no `workedMinutes`
         * and fall back to the span, which for a single-session day is identical.
         */
        durH: {
          $cond: [
            { $gt: [{ $ifNull: ["$workedMinutes", 0] }, 0] },
            { $divide: ["$workedMinutes", 60] },
            {
              $cond: [
                { $and: [{ $eq: ["$status", shiftStatus.ENDED] }, { $ne: ["$endTime", null] }] },
                { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] },
                0,
              ],
            },
          ],
        },
        autoClosedSessions: {
          $size: {
            $filter: {
              input: { $ifNull: ["$segments", []] },
              as: "s",
              cond: { $eq: ["$$s.autoClosed", true] },
            },
          },
        },
        forgotSessions: {
          $size: {
            $filter: {
              input: { $ifNull: ["$segments", []] },
              as: "s",
              cond: { $in: ["$$s.closeReason", FORGOT_CLOSE_REASONS] },
            },
          },
        },
      },
    },
  ]);

  const byUser = new Map<string, UserShiftStats>();
  for (const r of rows as any[]) {
    const uid = String(r.userId);
    let entry = byUser.get(uid);
    if (!entry) {
      entry = { shifts: [], earliestByDay: new Map() };
      byUser.set(uid, entry);
    }
    // Legacy rows have no segments, so fall back to the day-level flags —
    // pre-collapse one shift document WAS one session.
    const sessions = Math.max(1, r.sessions ?? 1);
    const shift: ProjectedShift = {
      dayKey: r.dayKey,
      localMin: r.localMin,
      durH: r.durH ?? 0,
      open: !!r.open,
      sessions,
      autoClosedSessions: r.autoClosedSessions || (r.autoClosed ? 1 : 0),
      forgotSessions:
        r.forgotSessions ||
        (r.autoClosed && FORGOT_CLOSE_REASONS.includes(r.closeReason) ? 1 : 0),
      autoClosed: !!r.autoClosed,
      closeReason: r.closeReason,
    };
    entry.shifts.push(shift);
    const prev = entry.earliestByDay.get(shift.dayKey);
    if (prev === undefined || shift.localMin < prev) {
      entry.earliestByDay.set(shift.dayKey, shift.localMin);
    }
  }
  return byUser;
}

/** Empty stats, so callers can treat "no shifts at all" uniformly. */
export const EMPTY_SHIFT_STATS: UserShiftStats = { shifts: [], earliestByDay: new Map() };

const DAY_MS = 86400000;

/**
 * Expected working days inside `[from, to)` for one employee.
 *
 * The window is clipped to the join date so a mid-period hire is prorated rather
 * than charged for days before they existed.
 *
 * KNOWN LIMITATION: this is a proration of calendar days, not a real weekday or
 * holiday calendar — `expectedDaysPerWeek` is a bare count in Settings, so which
 * *specific* days were expected is unknowable. Callers that credit particular
 * days (approved leave) must therefore clamp against this total rather than
 * assuming the days line up. A calendar-driven version (weekend days in Settings)
 * is the proper fix and remains a follow-up.
 */
export function expectedDaysInRange(
  from: Date,
  to: Date,
  createdAt: Date | string | undefined | null,
  settings: AttendanceSettings,
): number {
  const joinedMs = createdAt ? new Date(createdAt).getTime() : from.getTime();
  const effectiveStart = Math.max(from.getTime(), joinedMs);
  const calendarDays = Math.max(0, Math.round((to.getTime() - effectiveStart) / DAY_MS));
  return Math.max(0, Math.round((calendarDays * settings.expectedDaysPerWeek) / 7));
}
