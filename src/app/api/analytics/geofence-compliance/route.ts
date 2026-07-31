/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Shift } from "@/models/Shift";
import { Visit } from "@/models/Visit";
import { Hospital } from "@/models/Hospital";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { fenceStatus } from "@/models/enum.constants";

export const dynamic = "force-dynamic";

const OUTLIER_LIMIT = 500;

interface Counts {
  IN_RANGE: number;
  OUT_OF_RANGE: number;
  NO_LOCATION_FIX: number;
  HOSPITAL_NOT_CONFIGURED: number;
  /** IN_RANGE + OUT_OF_RANGE — records with a real proximity verdict. */
  evaluated: number;
  total: number;
  inRangePct: number;
}

function summarize(groups: { _id: string; count: number }[]): Counts {
  const c: Counts = { IN_RANGE: 0, OUT_OF_RANGE: 0, NO_LOCATION_FIX: 0, HOSPITAL_NOT_CONFIGURED: 0, evaluated: 0, total: 0, inRangePct: 0 };
  for (const g of groups) {
    if (g._id && g._id in c) (c as any)[g._id] = g.count;
    c.total += g.count;
  }
  c.evaluated = c.IN_RANGE + c.OUT_OF_RANGE;
  c.inRangePct = c.evaluated ? Math.round((c.IN_RANGE / c.evaluated) * 100) : 0;
  return c;
}

/** Outlier (OUT_OF_RANGE) pipeline for a collection keyed on its user/time fields. */
function outlierPipeline(match: any, userField: string, timeField: string, type: "shift" | "visit"): any[] {
  return [
    { $match: { ...match, startFenceStatus: fenceStatus.OUT_OF_RANGE } },
    { $lookup: { from: "users", localField: userField, foreignField: "_id", as: "u" } },
    { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "hospitals", localField: "hospitalId", foreignField: "_id", as: "h" } },
    { $unwind: { path: "$h", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        type: { $literal: type },
        time: `$${timeField}`,
        employee: {
          $trim: { input: { $concat: [{ $ifNull: ["$u.firstName", ""] }, " ", { $ifNull: ["$u.lastName", ""] }] } },
        },
        hospital: { $ifNull: ["$h.name", "غير محدد"] },
        distanceMeters: "$startDistanceMeters",
        lat: "$startLocation.lat",
        lng: "$startLocation.lng",
        hospitalLat: "$h.location.lat",
        hospitalLng: "$h.location.lng",
      },
    },
    { $sort: { time: -1 } },
    { $limit: OUTLIER_LIMIT },
  ];
}

/**
 * Geofence compliance report: status counts and % in-range for shift and visit
 * check-ins over the range, the list of out-of-range check-ins, and hospitals
 * still missing coordinates (setup to-do).
 */
export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);

    const excludedIds = await getExcludedUserIds();
    const shiftMatch = { startTime: { $gte: from, $lt: to }, ...excludeUsers("userId", excludedIds) };
    const visitMatch = { createdAt: { $gte: from, $lt: to }, isActive: true, ...excludeUsers("createdBy", excludedIds) };

    const [shiftGroups, visitGroups, shiftOutliers, visitOutliers, hospitalsNeedingLocation] = await Promise.all([
      Shift.aggregate([{ $match: { ...shiftMatch, startFenceStatus: { $ne: null } } }, { $group: { _id: "$startFenceStatus", count: { $sum: 1 } } }]),
      Visit.aggregate([{ $match: { ...visitMatch, startFenceStatus: { $ne: null } } }, { $group: { _id: "$startFenceStatus", count: { $sum: 1 } } }]),
      Shift.aggregate(outlierPipeline(shiftMatch, "userId", "startTime", "shift")),
      Visit.aggregate(outlierPipeline(visitMatch, "createdBy", "startTime", "visit")),
      Hospital.find({ isActive: true, "location.lat": null }).select("name city district").lean(),
    ]);

    const shifts = summarize(shiftGroups as any);
    const visits = summarize(visitGroups as any);
    const combinedEvaluated = shifts.evaluated + visits.evaluated;
    const combinedInRange = shifts.IN_RANGE + visits.IN_RANGE;
    const combinedInRangePct = combinedEvaluated ? Math.round((combinedInRange / combinedEvaluated) * 100) : 0;

    // Merge + re-sort the two outlier streams, keeping the newest overall.
    const outliers = [...(shiftOutliers as any[]), ...(visitOutliers as any[])]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, OUTLIER_LIMIT);

    return NextResponse.json(
      {
        summary: { shifts, visits, combinedInRangePct },
        outliers,
        outliersTruncated: (shiftOutliers as any[]).length >= OUTLIER_LIMIT || (visitOutliers as any[]).length >= OUTLIER_LIMIT,
        hospitalsNeedingLocation,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute geofence compliance" }, { status: 500 });
  }
}
