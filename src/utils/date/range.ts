/**
 * Date-range helpers for the analytics endpoints.
 *
 * - Parses `?from` / `?to` (ISO) with a sensible default (last 6 months, to
 *   match the current admin-home default filter).
 * - Computes the *previous comparable period* (same length, immediately before
 *   `from`) so endpoints can return ▲▼ deltas.
 * - Maps a `granularity` (day|week|month) to a `$dateTrunc` unit.
 */

export const TIMEZONE = "Asia/Riyadh";

export type Granularity = "day" | "week" | "month";

export interface DateRange {
  /** Inclusive start of the current window. */
  from: Date;
  /** Exclusive end of the current window. */
  to: Date;
  /** Inclusive start of the previous comparable window. */
  prevFrom: Date;
  /** Exclusive end of the previous comparable window (== from). */
  prevTo: Date;
}

const DEFAULT_RANGE_MONTHS = 6;

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/**
 * Parse the `from`/`to` query params into a {@link DateRange}. Invalid or
 * missing values fall back to "now" (for `to`) and "6 months before `to`"
 * (for `from`). The previous period mirrors the current window's length.
 */
export function parseRange(searchParams: URLSearchParams): DateRange {
  const now = new Date();

  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");

  let to = toParam ? new Date(toParam) : now;
  if (!isValidDate(to)) to = now;

  let from: Date;
  if (fromParam) {
    from = new Date(fromParam);
    if (!isValidDate(from)) {
      from = new Date(to);
      from.setMonth(from.getMonth() - DEFAULT_RANGE_MONTHS);
    }
  } else {
    from = new Date(to);
    from.setMonth(from.getMonth() - DEFAULT_RANGE_MONTHS);
  }

  // Guard against an inverted range.
  if (from.getTime() > to.getTime()) {
    const swap = from;
    from = to;
    to = swap;
  }

  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - span);

  return { from, to, prevFrom, prevTo };
}

/** Read `?granularity=day|week|month`, defaulting to `day`. */
export function parseGranularity(searchParams: URLSearchParams): Granularity {
  const g = searchParams.get("granularity");
  if (g === "week" || g === "month") return g;
  return "day";
}

/* ------------------------------------------------------------------ *
 * Calendar-day keys (`YYYY-MM-DD` in Riyadh local time)
 *
 * Leave requests are stored as date-only strings rather than instants: a
 * "day off" is a calendar day, not a 24h window, and a UTC timestamp would
 * drift across the +03 boundary. `YYYY-MM-DD` also sorts lexicographically,
 * so range queries work as plain string comparisons in MongoDB.
 *
 * Shift aggregations project the same shape via
 * `$dateToString: { format: "%Y-%m-%d", timezone: TIMEZONE }`, so attendance
 * and leave can be intersected directly as sets of day keys.
 * ------------------------------------------------------------------ */

/** `YYYY-MM-DD` — the Riyadh calendar day an instant falls on. */
export function riyadhDayKey(d: Date): string {
  // "en-CA" is the locale whose short date format is already ISO-shaped.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** True for a well-formed `YYYY-MM-DD` string that names a real calendar date. */
export function isValidDayKey(key: unknown): key is string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
  );
}

/** Day key shifted by `days` (negative to go back). */
export function addDaysToDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Whole days from `startKey` to `endKey` (0 when equal, negative if inverted). */
export function dayKeyDiff(startKey: string, endKey: string): number {
  const toMs = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(endKey) - toMs(startKey)) / 86400000);
}

/** Every day key from `startKey` to `endKey` inclusive; empty when inverted. */
export function enumerateDayKeys(startKey: string, endKey: string): string[] {
  const span = dayKeyDiff(startKey, endKey);
  if (span < 0) return [];
  const out: string[] = [];
  for (let i = 0; i <= span; i++) out.push(addDaysToDayKey(startKey, i));
  return out;
}

/**
 * Bucket a day key the same way `$dateTrunc` would, so leave counts line up
 * with the shift timeseries buckets. Weeks start on Sunday to match MongoDB's
 * `$dateTrunc` default (`startOfWeek: "sunday"`).
 */
/**
 * The instant a Riyadh calendar day starts, as an ISO string — exactly what
 * `$dateTrunc: { unit: "day", timezone: TIMEZONE }` yields for that day. Lets
 * day-keyed data (leave) join timeseries buckets produced in the aggregation
 * pipeline. Riyadh is UTC+3 year-round (no DST), so the offset is a constant.
 */
export function riyadhDayStartISO(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -3, 0, 0, 0)).toISOString();
}

export function bucketKeyForDay(dayKey: string, granularity: Granularity): string {
  if (granularity === "month") return `${dayKey.slice(0, 7)}-01`;
  if (granularity === "week") {
    const [y, m, d] = dayKey.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
    return addDaysToDayKey(dayKey, -dow);
  }
  return dayKey;
}
