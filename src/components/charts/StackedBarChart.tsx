"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { withRowPercent } from "./constants";
import { NoData } from "./NoData";

/** Horizontal stacked bars for composition (e.g. warehouse vs hospital stock). */
export default function StackedBarChart({
  data,
  nameKey,
  series,
  topN,
  height = 300,
}: {
  data: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  nameKey: string;
  series: { key: string; label: string; color: string }[];
  topN?: number;
  height?: number;
}) {
  let rows = [...(data || [])];
  if (topN) rows = rows.slice(0, topN);

  return (
    <div dir="ltr" style={{ width: "100%", height }}>
      {rows.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          <BarChart layout="vertical" data={rows} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey={nameKey} width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={withRowPercent(series.map((s) => s.key))} />
            <Legend />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
