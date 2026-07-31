/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { userRoles } from "@/models/enum.constants";
import { Mom } from "@/models/Mom";
import { Visit } from "@/models/Visit";
import { User } from "@/models/User";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import type { Types } from "mongoose";

export const dynamic = "force-dynamic";

/** Range-bound KPI block (moms + derived sums + visits + active hospitals). */
async function computeMetrics(from: Date, to: Date, excludedIds: Types.ObjectId[]) {
  const byEmployee = excludeUsers("createdBy", excludedIds);
  const range = { isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee };

  const [momAgg, visits, activeHospitals, employees] = await Promise.all([
    Mom.aggregate([
      { $match: range },
      {
        $group: {
          _id: null,
          moms: { $sum: 1 },
          newborns: { $sum: { $ifNull: ["$numberOfnewborns", 0] } },
          kids: { $sum: { $ifNull: ["$numberOfKids", 0] } },
          males: { $sum: { $ifNull: ["$numberOfMales", 0] } },
          females: { $sum: { $ifNull: ["$numberOfFemales", 0] } },
          twinsPlus: { $sum: { $cond: [{ $gte: [{ $ifNull: ["$numberOfnewborns", 0] }, 2] }, 1, 0] } },
          consent: { $sum: { $cond: ["$allowFutureCom", 1, 0] } },
          withSignature: {
            $sum: {
              $cond: [{ $and: [{ $ne: ["$signature", ""] }, { $ne: ["$signature", null] }] }, 1, 0],
            },
          },
          productsDistributed: { $sum: { $size: { $ifNull: ["$survey", []] } } },
        },
      },
    ]),
    Visit.countDocuments({ isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee }),
    Visit.distinct("hospitalId", { isActive: true, createdAt: { $gte: from, $lt: to }, ...byEmployee }),
    // Cumulative active employees created before the window end (growth delta).
    User.countDocuments({
      role: userRoles.EMPLOYEE,
      isActive: true,
      createdAt: { $lt: to },
      ...excludeUsers("_id", excludedIds),
    }),
  ]);

  const m = momAgg[0] || {};
  return {
    moms: m.moms || 0,
    visits,
    newborns: m.newborns || 0,
    kids: m.kids || 0,
    males: m.males || 0,
    females: m.females || 0,
    twinsPlus: m.twinsPlus || 0,
    consent: m.consent || 0,
    withSignature: m.withSignature || 0,
    productsDistributed: m.productsDistributed || 0,
    activeHospitals: (activeHospitals as any[]).filter(Boolean).length,
    employees,
  };
}

export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to, prevFrom, prevTo } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const [current, previous, employeesOnShift, reachAllTime] = await Promise.all([
      computeMetrics(from, to, excludedIds),
      computeMetrics(prevFrom, prevTo, excludedIds),
      User.countDocuments({ isOnShift: true, isActive: true, ...excludeUsers("_id", excludedIds) }),
      Mom.countDocuments({ isActive: true, ...excludeUsers("createdBy", excludedIds) }),
    ]);

    return NextResponse.json({ current, previous, employeesOnShift, reachAllTime }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute overview" }, { status: 500 });
  }
}
