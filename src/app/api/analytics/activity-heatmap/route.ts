/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/** Mom registrations bucketed by weekday (1=Sun..7=Sat) × hour-of-day (Riyadh). */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const data = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      {
        $group: {
          _id: {
            dow: { $dayOfWeek: { date: "$createdAt", timezone: TIMEZONE } },
            hour: { $hour: { date: "$createdAt", timezone: TIMEZONE } },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, dow: "$_id.dow", hour: "$_id.hour", count: 1 } },
    ]);

    const max = data.reduce((m: number, d: any) => Math.max(m, d.count || 0), 0);

    return NextResponse.json({ data, max }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute activity heatmap" }, { status: 500 });
  }
}
