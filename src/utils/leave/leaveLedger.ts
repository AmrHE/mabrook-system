/* eslint-disable @typescript-eslint/no-explicit-any */
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus, leavePayMode, leaveType } from "@/models/enum.constants";
import { enumerateDayKeys, riyadhDayKey } from "@/utils/date/range";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

/**
 * Fraction of a day's rate charged for one approved UNPAID permit (a delay
 * permit or an early leave), per the business rule:
 *
 *   - approved PAID anything            → no charge
 *   - approved UNPAID full-day leave    → 1 day, identical to a no-show
 *   - approved UNPAID permit            → 1/4 day, FLAT (never pro-rated by minutes)
 *
 * Hardcoded like the `salary / 30` divisor in the salary report; promoting it to
 * an admin-editable Settings field later is a one-line change.
 */
export const UNPAID_PERMIT_DAY_FRACTION = 0.25;

/**
 * Everything the reports need to know about one user's leave inside a window.
 *
 * Full-day leave is kept as sets of `YYYY-MM-DD` Riyadh day keys rather than
 * counts so callers can subtract days the employee actually worked — crediting a
 * leave day the employee also checked in on would pay for the same day twice.
 * Those keys are directly comparable with `earliestByDay` from
 * `src/utils/attendance/arrivals.ts`.
 */
export interface LeaveLedgerEntry {
  /** Approved PAID full-day leave (VACATION / CASUAL) — forgiven by payroll. */
  paidLeaveDayKeys: Set<string>;
  /** Approved UNPAID full-day leave — charged exactly like a no-show. */
  unpaidLeaveDayKeys: Set<string>;
  /** dayKey → approved delay-permit minutes, which relax that day's late threshold. */
  delayMinutesByDay: Map<string, number>;
  /** dayKey → approved early-leave minutes. */
  earlyMinutesByDay: Map<string, number>;
  /** All approved permit minutes. Feeds the hours-adherence math only, never the money. */
  excusedMinutes: number;
  /** Days carrying an approved UNPAID permit — each costs UNPAID_PERMIT_DAY_FRACTION. */
  unpaidPermitDayKeys: Set<string>;
  delayPermitDays: number;
  earlyLeaveDays: number;
  /**
   * Approved days per `leaveType`, split by pay mode. Same clipped days as the sets
   * above, so a composition chart built from these always agrees with the totals
   * rather than double-counting a span that runs past the window edge.
   */
  paidDaysByType: Record<string, number>;
  unpaidDaysByType: Record<string, number>;
  pendingRequests: number;
  pendingDays: number;
  rejectedRequests: number;
  approvedRequests: number;
}

export function emptyLeaveLedgerEntry(): LeaveLedgerEntry {
  return {
    paidLeaveDayKeys: new Set(),
    unpaidLeaveDayKeys: new Set(),
    delayMinutesByDay: new Map(),
    earlyMinutesByDay: new Map(),
    excusedMinutes: 0,
    unpaidPermitDayKeys: new Set(),
    delayPermitDays: 0,
    earlyLeaveDays: 0,
    paidDaysByType: {},
    unpaidDaysByType: {},
    pendingRequests: 0,
    pendingDays: 0,
    rejectedRequests: 0,
    approvedRequests: 0,
  };
}

/** Number of `days` not present in `exclude` — e.g. leave days not already worked. */
export function countNotIn(days: Set<string>, exclude: Set<string>): number {
  let n = 0;
  for (const d of days) if (!exclude.has(d)) n++;
  return n;
}

/** Number of `days` also present in `include` — e.g. permit days actually attended. */
export function countIn(days: Set<string>, include: Set<string>): number {
  let n = 0;
  for (const d of days) if (include.has(d)) n++;
  return n;
}

/** All approved full-day leave (paid + unpaid), for adherence and "on leave" counts. */
export function allLeaveDayKeys(entry: LeaveLedgerEntry): Set<string> {
  return new Set([...entry.paidLeaveDayKeys, ...entry.unpaidLeaveDayKeys]);
}

const PERMIT_TYPES = new Set<string>([leaveType.DELAY_PERMIT, leaveType.EARLY_LEAVE]);

/**
 * Build the per-user leave ledger for `[from, to)`.
 *
 * `to` is an exclusive instant, so the last calendar day in the window is the
 * day containing `to - 1ms`. Each request's span is clipped to the window before
 * its days are counted, so a vacation straddling a month boundary contributes
 * only the days that actually fall inside the report period.
 *
 * CANCELLED requests are ignored entirely — a withdrawn request never happened.
 *
 * Internal/test accounts are dropped here for the same reason as in
 * `loadShiftStats`: every caller is an analytics or report endpoint, and some sum
 * the returned Map across all users rather than driving from a User cohort.
 */
export async function buildLeaveLedger(from: Date, to: Date): Promise<Map<string, LeaveLedgerEntry>> {
  const byUser = new Map<string, LeaveLedgerEntry>();
  if (to.getTime() <= from.getTime()) return byUser;

  const fromKey = riyadhDayKey(from);
  const toKey = riyadhDayKey(new Date(to.getTime() - 1));
  const excludedIds = await getExcludedUserIds();

  const docs = await LeaveRequest.find({
    isActive: true,
    status: { $in: [leaveStatus.APPROVED, leaveStatus.PENDING, leaveStatus.REJECTED] },
    // Span overlap, as lexicographic string comparisons on `YYYY-MM-DD`.
    endDay: { $gte: fromKey },
    startDay: { $lte: toKey },
    ...excludeUsers("userId", excludedIds),
  })
    .select("userId type startDay endDay minutes status payMode")
    .lean();

  for (const doc of docs as any[]) {
    const uid = String(doc.userId);
    let entry = byUser.get(uid);
    if (!entry) {
      entry = emptyLeaveLedgerEntry();
      byUser.set(uid, entry);
    }

    const clipStart = doc.startDay > fromKey ? doc.startDay : fromKey;
    const clipEnd = doc.endDay < toKey ? doc.endDay : toKey;
    const days = enumerateDayKeys(clipStart, clipEnd);
    if (days.length === 0) continue;

    if (doc.status === leaveStatus.PENDING) {
      entry.pendingRequests++;
      entry.pendingDays += days.length;
      continue;
    }
    if (doc.status === leaveStatus.REJECTED) {
      entry.rejectedRequests++;
      continue;
    }

    // APPROVED from here on.
    entry.approvedRequests++;
    // A missing payMode shouldn't happen (approval requires it) but if legacy or
    // hand-edited data lacks one, default to PAID: never charge on a guess.
    const unpaid = doc.payMode === leavePayMode.UNPAID;

    const byType = unpaid ? entry.unpaidDaysByType : entry.paidDaysByType;
    byType[doc.type] = (byType[doc.type] ?? 0) + days.length;

    if (PERMIT_TYPES.has(doc.type)) {
      const minutes = Number(doc.minutes) || 0;
      const target = doc.type === leaveType.DELAY_PERMIT ? entry.delayMinutesByDay : entry.earlyMinutesByDay;
      for (const day of days) {
        target.set(day, (target.get(day) ?? 0) + minutes);
        entry.excusedMinutes += minutes;
        if (unpaid) entry.unpaidPermitDayKeys.add(day);
      }
      if (doc.type === leaveType.DELAY_PERMIT) entry.delayPermitDays += days.length;
      else entry.earlyLeaveDays += days.length;
      continue;
    }

    // Full-day leave: VACATION / CASUAL.
    const bucket = unpaid ? entry.unpaidLeaveDayKeys : entry.paidLeaveDayKeys;
    for (const day of days) bucket.add(day);
  }

  return byUser;
}
