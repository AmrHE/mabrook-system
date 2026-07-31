/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Visit } from "@/models/Visit";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/** Visit GPS points (with valid coords) for the coverage map, joined to hospital. */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const raw = await Visit.aggregate([
      {
        $match: {
          isActive: true,
          createdAt: { $gte: from, $lt: to },
          ...excludeUsers("createdBy", excludedIds),
          "startLocation.lat": { $ne: null },
          "startLocation.lng": { $ne: null },
        },
      },
      { $lookup: { from: "hospitals", localField: "hospitalId", foreignField: "_id", as: "h" } },
      { $unwind: { path: "$h", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          lat: "$startLocation.lat",
          lng: "$startLocation.lng",
          hospital: { $ifNull: ["$h.name", "غير محدد"] },
          city: { $ifNull: ["$h.city", ""] },
          moms: { $size: { $ifNull: ["$moms", []] } },
        },
      },
    ]);

    // Keep only finite, non-(0,0) coordinates.
    const data = (raw as any[]).filter(
      (v) => Number.isFinite(v.lat) && Number.isFinite(v.lng) && !(v.lat === 0 && v.lng === 0),
    );

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute visit locations" }, { status: 500 });
  }
}
