/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/**
 * Box × employee distribution matrix: for each box, how many each employee
 * handed out in the range. Returned in long form (one row per box/employee
 * pair) plus the distinct box and employee axes, so the client can pivot into a
 * heat table.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const cells = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $unwind: "$survey" },
      {
        $group: {
          _id: { box: "$survey.product", employee: "$createdBy" },
          count: { $sum: 1 },
        },
      },
      { $lookup: { from: "products", localField: "_id.box", foreignField: "_id", as: "p" } },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "_id.employee", foreignField: "_id", as: "u" } },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          boxId: "$_id.box",
          boxName: { $ifNull: ["$p.name", "غير محدد"] },
          employeeId: "$_id.employee",
          employeeName: {
            $trim: {
              input: { $concat: [{ $ifNull: ["$u.firstName", ""] }, " ", { $ifNull: ["$u.lastName", ""] }] },
            },
          },
          count: 1,
        },
      },
    ]);

    // Distinct axes, ordered by total distribution (busiest first).
    const boxTotals = new Map<string, { id: string; name: string; total: number }>();
    const empTotals = new Map<string, { id: string; name: string; total: number }>();
    for (const c of cells as any[]) {
      c.employeeName = c.employeeName || "غير محدد";
      const b = boxTotals.get(String(c.boxId)) || { id: String(c.boxId), name: c.boxName, total: 0 };
      b.total += c.count;
      boxTotals.set(String(c.boxId), b);
      const e = empTotals.get(String(c.employeeId)) || { id: String(c.employeeId), name: c.employeeName, total: 0 };
      e.total += c.count;
      empTotals.set(String(c.employeeId), e);
    }
    const boxes = [...boxTotals.values()].sort((a, b) => b.total - a.total);
    const employees = [...empTotals.values()].sort((a, b) => b.total - a.total);

    return NextResponse.json({ cells, boxes, employees }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute box/employee breakdown" }, { status: 500 });
  }
}
