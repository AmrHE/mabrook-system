/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/** Mothers/visits grouped by hospital city and district (Mom → Visit → Hospital). */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const base = [
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $lookup: { from: "visits", localField: "visitId", foreignField: "_id", as: "v" } },
      { $unwind: { path: "$v", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "hospitals", localField: "v.hospitalId", foreignField: "_id", as: "h" } },
      { $unwind: { path: "$h", preserveNullAndEmptyArrays: true } },
    ];

    const [cities, districts] = await Promise.all([
      Mom.aggregate([
        ...base,
        { $group: { _id: { $ifNull: ["$h.city", "غير محدد"] }, moms: { $sum: 1 }, visits: { $addToSet: "$visitId" } } },
        { $project: { _id: 0, name: "$_id", moms: 1, visits: { $size: "$visits" } } },
        { $sort: { moms: -1 } },
      ]),
      Mom.aggregate([
        ...base,
        {
          $group: {
            _id: { city: { $ifNull: ["$h.city", "غير محدد"] }, district: { $ifNull: ["$h.district", "غير محدد"] } },
            moms: { $sum: 1 },
            visits: { $addToSet: "$visitId" },
          },
        },
        { $project: { _id: 0, name: "$_id.district", city: "$_id.city", moms: 1, visits: { $size: "$visits" } } },
        { $sort: { moms: -1 } },
      ]),
    ]);

    return NextResponse.json({ cities, districts }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute geo breakdown" }, { status: 500 });
  }
}
