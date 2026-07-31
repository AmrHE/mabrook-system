"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, withPercent } from "./constants";
import { NoData } from "./NoData";

export default function GenderDonut({ data }: { data: { males: number; females: number } }) {
  const slices = [
    { name: "ذكور", value: data?.males || 0, color: CHART_COLORS.primary },
    { name: "إناث", value: data?.females || 0, color: CHART_COLORS.pink },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <div dir="ltr" style={{ width: "100%", height: 240 }}>
      {total === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip formatter={withPercent(total)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
