import { TIMEZONE } from "@/utils/date/range";

/** Shared palette for the dashboard charts (RTL Arabic UI). */
export const CHART_COLORS = {
  primary: "#5570F1",
  green: "#22C55E",
  orange: "#F59E0B",
  red: "#EF4444",
  pink: "#EC4899",
  purple: "#8B5CF6",
  teal: "#14B8A6",
  slate: "#64748B",
};

/** Categorical palette for pies / multi-series charts. */
export const PIE_PALETTE = [
  "#5570F1",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#EC4899",
  "#64748B",
  "#EAB308",
  "#06B6D4",
];

export type Granularity = "day" | "week" | "month";

/** Western-digit thousands formatting (matches existing en-SA UI). */
export const fmtNumber = (n?: number): string => (n ?? 0).toLocaleString("en-US");

/** Integer percentage of `part` relative to `whole` (0 when the whole is falsy). */
export const pct = (part?: number, whole?: number): number =>
  !whole ? 0 : Math.round(((part || 0) / whole) * 100);

/** Recharts tooltip formatter that appends a share-of-total %, e.g. "151 (49%)".
 *  Pass a grand total, or a map of dataKey→total for multi-series charts.
 *  Params are `unknown` to stay assignable to Recharts' broad `Formatter` type. */
export const withPercent =
  (total: number | Record<string, number>) =>
  (value: unknown, _name?: unknown, entry?: unknown): string => {
    const v = Number(value);
    const dataKey = (entry as { dataKey?: string | number } | undefined)?.dataKey;
    const whole = typeof total === "number" ? total : total[String(dataKey ?? "")] ?? 0;
    return whole ? `${fmtNumber(v)} (${pct(v, whole)}%)` : fmtNumber(v);
  };

/** Tooltip formatter for stacked/composition bars: % is the value's share of the
 *  hovered row's own stack total (keys summed from the datum's payload). */
export const withRowPercent =
  (keys: string[]) =>
  (value: unknown, _name?: unknown, entry?: unknown): string => {
    const v = Number(value);
    const row = (entry as { payload?: Record<string, number> } | undefined)?.payload ?? {};
    const total = keys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
    return total ? `${fmtNumber(v)} (${pct(v, total)}%)` : fmtNumber(v);
  };

export type Delta = { pct: number; dir: "up" | "down" | "flat" };

/** Period-over-period change as an absolute percentage plus a direction. */
export function computeDelta(cur?: number, prev?: number): Delta | null {
  if (cur === undefined || prev === undefined) return null;
  if (prev === 0) return cur === 0 ? { pct: 0, dir: "flat" } : { pct: 100, dir: "up" };
  const change = Math.round(((cur - prev) / prev) * 100);
  return { pct: Math.abs(change), dir: change > 0 ? "up" : change < 0 ? "down" : "flat" };
}

/** Axis label for a bucketed date, formatted per granularity. */
export function fmtDate(value: string | Date, granularity: Granularity): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  if (granularity === "month") {
    return d.toLocaleDateString("en-SA", { month: "short", year: "numeric", timeZone: TIMEZONE });
  }
  return d.toLocaleDateString("en-SA", { day: "2-digit", month: "short", timeZone: TIMEZONE });
}
