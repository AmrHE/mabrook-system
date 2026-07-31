/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * Per-hospital ranking. Moms have no hospitalId, so we join through the visit:
 * Mom -> Visit -> Hospital. The client slices top/bottom N.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const data = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $lookup: { from: "visits", localField: "visitId", foreignField: "_id", as: "visit" } },
      { $unwind: { path: "$visit", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$visit.hospitalId",
          moms: { $sum: 1 },
          productsDistributed: { $sum: { $size: { $ifNull: ["$survey", []] } } },
          visits: { $addToSet: "$visitId" },
          consent: { $sum: { $cond: ["$allowFutureCom", 1, 0] } },
          signed: { $sum: { $cond: [{ $and: [{ $ne: ["$signature", ""] }, { $ne: ["$signature", null] }] }, 1, 0] } },
        },
      },
      { $lookup: { from: "hospitals", localField: "_id", foreignField: "_id", as: "h" } },
      { $unwind: { path: "$h", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          hospitalId: "$_id",
          name: { $ifNull: ["$h.name", "غير محدد"] },
          city: { $ifNull: ["$h.city", ""] },
          district: { $ifNull: ["$h.district", ""] },
          moms: 1,
          productsDistributed: 1,
          visitsCount: { $size: "$visits" },
          stockUnits: { $sum: "$h.productStocks.quantity" },
          consent: 1,
          signed: 1,
        },
      },
      { $sort: { moms: -1 } },
    ]);

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute hospitals ranking" }, { status: 500 });
  }
}
