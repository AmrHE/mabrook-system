/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Visit } from "@/models/Visit";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { getMomRateBaseline, lowMomRateExpr, visitDurHExpr } from "@/utils/analytics/visitProductivity";

export const dynamic = "force-dynamic";

const fmt = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }) : "";

const coord = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? `${loc.lat}, ${loc.lng}` : "";

const rawCoord = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? { lat: loc.lat, lng: loc.lng } : null;

/** Flattened visit rows (+ hospital + employee + start/end location) for the Visits report. */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const [excludedIds, baseline] = await Promise.all([getExcludedUserIds(), getMomRateBaseline()]);

    const agg = await Visit.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $lookup: { from: "hospitals", localField: "hospitalId", foreignField: "_id", as: "hospital" } },
      { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "employee" } },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          hospital: { $ifNull: ["$hospital.name", "غير محدد"] },
          city: { $ifNull: ["$hospital.city", ""] },
          district: { $ifNull: ["$hospital.district", ""] },
          employee: {
            $trim: { input: { $concat: [{ $ifNull: ["$employee.firstName", ""] }, " ", { $ifNull: ["$employee.lastName", ""] }] } },
          },
          email: { $ifNull: ["$employee.email", ""] },
          momsCount: { $size: { $ifNull: ["$moms", []] } },
          status: 1,
          startTime: 1,
          endTime: 1,
          // Sessions, not the raw span — a resumed visit must not be charged for
          // the gap. visitDurHExpr falls back to the span for pre-resume rows.
          durationHours: {
            $cond: [
              { $and: [{ $eq: ["$status", shiftStatus.ENDED] }, { $ne: ["$endTime", null] }] },
              { $round: [visitDurHExpr(), 1] },
              null,
            ],
          },
          momsPerHour: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", shiftStatus.ENDED] },
                  { $ne: ["$endTime", null] },
                  { $gt: [visitDurHExpr(), 0] },
                ],
              },
              { $round: [{ $divide: [{ $size: { $ifNull: ["$moms", []] } }, visitDurHExpr()] }, 1] },
              null,
            ],
          },
          // Same expression the data-quality counter uses, so the two agree.
          lowMomRate: lowMomRateExpr(baseline),
          notes: { $ifNull: ["$notes", ""] },
          startLocation: 1,
          endLocation: 1,
          // Anchors the geofence circle on the row's location map.
          hospitalLocation: "$hospital.location",
        },
      },
      { $sort: { startTime: -1 } },
    ]);

    const rows = (agg as any[]).map((r) => ({
      hospital: r.hospital,
      city: r.city,
      district: r.district,
      employee: r.employee || "غير محدد",
      email: r.email,
      momsCount: r.momsCount ?? 0,
      status: r.status === shiftStatus.ENDED ? "منتهية" : "جارية",
      startTime: fmt(r.startTime),
      endTime: fmt(r.endTime),
      durationHours: r.durationHours ?? "",
      momsPerHour: r.momsPerHour ?? "",
      // Plain strings so the facet filter and CSV work with no extra wiring;
      // "" for visits the flag doesn't judge, which matches neither facet option.
      lowMomRateLabel: r.durationHours == null ? "" : r.lowMomRate ? "نعم" : "لا",
      notes: r.notes ?? "",
      startLocation: coord(r.startLocation),
      endLocation: coord(r.endLocation),
      startLoc: rawCoord(r.startLocation),
      endLoc: rawCoord(r.endLocation),
      hospitalLoc: rawCoord(r.hospitalLocation),
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute visits rows" }, { status: 500 });
  }
}
