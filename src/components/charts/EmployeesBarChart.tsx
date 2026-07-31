"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, withPercent } from "./constants";
import { NoData } from "./NoData";

type Row = { id: string; name: string; moms: number; visits: number };

const N = 7;

export default function EmployeesBarChart({ data }: { data: Row[] }) {
  const slice = [...(data || [])]
    .sort((a, b) => b.moms - a.moms)
    .slice(0, N)
    .map((r) => ({ name: r.name || "—", moms: r.moms, visits: r.visits }));

  // Per-series share of all employees' totals (not just the shown top N).
  const totals = (data || []).reduce(
    (acc, r) => ({ moms: acc.moms + (r.moms || 0), visits: acc.visits + (r.visits || 0) }),
    { moms: 0, visits: 0 },
  );

  return (
    <div dir="ltr" style={{ width: "100%", height: 300 }}>
      {slice.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          <BarChart layout="vertical" data={slice} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={withPercent(totals)} />
            <Legend />
            <Bar dataKey="moms" name="الأمهات" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
            <Bar dataKey="visits" name="الزيارات" fill={CHART_COLORS.teal} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
