/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Visit } from "@/models/Visit";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { getMomRateBaseline, lowMomRateFilter, visitDurHExpr } from "@/utils/analytics/visitProductivity";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;

/**
 * The worst offenders for the "⚠ يحتاج انتباه" panel: ended visits whose
 * moms-per-hour is far below the team average. Range-bound (unlike open-shifts),
 * because an old bad visit isn't actionable — the panel is for the period the
 * admin is currently looking at.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const limitParam = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;

    const [excludedIds, baseline] = await Promise.all([getExcludedUserIds(), getMomRateBaseline()]);

    const agg = await Visit.aggregate([
      {
        $match: lowMomRateFilter(baseline, {
          createdAt: { $gte: from, $lt: to },
          ...excludeUsers("createdBy", excludedIds),
        }),
      },
      {
        $addFields: {
          // Sessions, not the raw span (see visitDurHExpr).
          durH: visitDurHExpr(),
          momsCount: { $size: { $ifNull: ["$moms", []] } },
        },
      },
      { $addFields: { momsPerHour: { $divide: ["$momsCount", "$durH"] } } },
      { $sort: { momsPerHour: 1 } },
      { $limit: limit },
      { $lookup: { from: "hospitals", localField: "hospitalId", foreignField: "_id", as: "hospital" } },
      { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "employee" } },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          momsCount: 1,
          durH: 1,
          momsPerHour: 1,
          hospitalName: { $ifNull: ["$hospital.name", "غير محدد"] },
          employeeName: {
            $trim: { input: { $concat: [{ $ifNull: ["$employee.firstName", ""] }, " ", { $ifNull: ["$employee.lastName", ""] }] } },
          },
        },
      },
    ]);

    const data = (agg as any[]).map((v) => ({
      visitId: String(v._id),
      employeeName: v.employeeName || "غير محدد",
      hospitalName: v.hospitalName,
      momsCount: v.momsCount,
      durationHours: Math.round(v.durH * 10) / 10,
      momsPerHour: Math.round(v.momsPerHour * 10) / 10,
    }));

    return NextResponse.json({ baseline, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "Failed to compute low-productivity visits" },
      { status: 500 },
    );
  }
}
