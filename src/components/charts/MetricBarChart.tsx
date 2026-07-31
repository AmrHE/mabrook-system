"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, fmtNumber, withPercent } from "./constants";
import { NoData } from "./NoData";

/**
 * Generic single-metric bar chart. `layout="vertical"` renders horizontal bars
 * (category on Y — good for long Arabic names); `layout="horizontal"` renders
 * vertical bars (good for short numeric categories like a distribution).
 */
export default function MetricBarChart({
  data,
  nameKey,
  valueKey,
  seriesName,
  color = CHART_COLORS.primary,
  topN,
  layout = "vertical",
  height = 300,
  sort = true,
  percentOfTotal = false,
}: {
  data: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  nameKey: string;
  valueKey: string;
  seriesName: string;
  color?: string;
  topN?: number;
  layout?: "vertical" | "horizontal";
  height?: number;
  sort?: boolean;
  /** Append each bar's share of the grand total (over ALL rows, before top-N) to the tooltip. */
  percentOfTotal?: boolean;
}) {
  let rows = [...(data || [])];
  if (sort) rows.sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
  if (topN) rows = rows.slice(0, topN);
  const hasAny = rows.some((r) => (r[valueKey] || 0) > 0);

  // Grand total over the full incoming data (not just the shown rows).
  const total = (data || []).reduce((s, r) => s + (Number(r[valueKey]) || 0), 0);
  const tipFormatter = percentOfTotal ? withPercent(total) : (value: unknown) => fmtNumber(Number(value));

  return (
    <div dir="ltr" style={{ width: "100%", height }}>
      {!hasAny ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          {layout === "vertical" ? (
            <BarChart layout="vertical" data={rows} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey={nameKey} width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tipFormatter} />
              <Bar dataKey={valueKey} name={seriesName} fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : (
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={tipFormatter} />
              <Bar dataKey={valueKey} name={seriesName} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
