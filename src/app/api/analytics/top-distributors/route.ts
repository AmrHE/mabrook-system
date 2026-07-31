/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * Employees ranked by how many boxes they distributed in the range. One
 * `mom.survey` entry = one box handed out, so we sum the survey size per
 * employee (Mom.createdBy).
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
      {
        $group: {
          _id: "$createdBy",
          boxes: { $sum: { $size: { $ifNull: ["$survey", []] } } },
          moms: { $sum: 1 },
        },
      },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          employeeId: "$_id",
          name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$u.firstName", ""] },
                  " ",
                  { $ifNull: ["$u.lastName", ""] },
                ],
              },
            },
          },
          boxes: 1,
          moms: 1,
        },
      },
      { $sort: { boxes: -1 } },
    ]);

    // Fall back to a placeholder name when the employee has no name set.
    const rows = (data as any[]).map((r) => ({ ...r, name: r.name || "غير محدد" }));

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute top distributors" }, { status: 500 });
  }
}
