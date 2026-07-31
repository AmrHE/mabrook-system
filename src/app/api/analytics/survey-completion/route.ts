/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/** Survey *completion* (answered vs blank) overall and per product. Answers are free text. */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const perProduct = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $unwind: "$survey" },
      { $unwind: "$survey.QA" },
      {
        $group: {
          _id: "$survey.product",
          expected: { $sum: 1 },
          answered: {
            $sum: {
              $cond: [{ $and: [{ $ne: ["$survey.QA.answer", ""] }, { $ne: ["$survey.QA.answer", null] }] }, 1, 0],
            },
          },
        },
      },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "p" } },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: { $ifNull: ["$p.name", "غير محدد"] },
          expected: 1,
          answered: 1,
          rate: {
            $cond: [{ $gt: ["$expected", 0] }, { $round: [{ $multiply: [{ $divide: ["$answered", "$expected"] }, 100] }, 0] }, 0],
          },
        },
      },
      { $sort: { rate: -1, expected: -1 } },
    ]);

    const expected = perProduct.reduce((s: number, p: any) => s + (p.expected || 0), 0);
    const answered = perProduct.reduce((s: number, p: any) => s + (p.answered || 0), 0);
    const rate = expected > 0 ? Math.round((answered / expected) * 100) : 0;

    return NextResponse.json({ overall: { expected, answered, rate }, perProduct }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute survey completion" }, { status: 500 });
  }
}
