"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, withPercent } from "./constants";
import { NoData } from "./NoData";

export default function MultipleBirthsChart({
  data,
}: {
  data: { singletons: number; twins: number; tripletsPlus: number };
}) {
  const chartData = [
    { name: "مفرد", value: data?.singletons || 0, color: CHART_COLORS.primary },
    { name: "توأم", value: data?.twins || 0, color: CHART_COLORS.orange },
    { name: "3+", value: data?.tripletsPlus || 0, color: CHART_COLORS.red },
  ];

  const total = chartData.reduce((acc, s) => acc + s.value, 0);

  return (
    <div dir="ltr" style={{ width: "100%", height: 240 }}>
      {total === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={withPercent(total)} />
            <Bar dataKey="value" name="الحالات" radius={[4, 4, 0, 0]}>
              {chartData.map((c, i) => (
                <Cell key={i} fill={c.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
