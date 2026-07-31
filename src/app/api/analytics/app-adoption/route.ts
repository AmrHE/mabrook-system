/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { normalizeNationality } from "@/utils/nationality/normalize";

export const dynamic = "force-dynamic";

/**
 * App adoption across moms in the range:
 * - summary: totals + adoption rate
 * - byApp: moms per app (installedApp unwound)
 * - byNationality: moms who installed ≥1 app, folded to canonical nationality
 * - byEmployee: installs + moms-with-app per registering employee
 *
 * `installedApp` is optional and absent on legacy docs → treated as [].
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const range = {
      isActive: true,
      createdAt: { $gte: from, $lt: to },
      ...excludeUsers("createdBy", await getExcludedUserIds()),
    };

    // Reusable expressions over the (possibly missing) installedApp array.
    const appsSize = { $size: { $ifNull: ["$installedApp", []] } };
    const hasApp = { $gt: [appsSize, 0] };

    const [summaryAgg, byApp, natRaw, byEmployee] = await Promise.all([
      Mom.aggregate([
        { $match: range },
        {
          $group: {
            _id: null,
            totalMoms: { $sum: 1 },
            momsWithApp: { $sum: { $cond: [hasApp, 1, 0] } },
            totalInstalls: { $sum: appsSize },
          },
        },
      ]),
      Mom.aggregate([
        { $match: range },
        { $project: { apps: { $ifNull: ["$installedApp", []] } } },
        { $unwind: "$apps" },
        { $group: { _id: "$apps", moms: { $sum: 1 } } },
        { $project: { _id: 0, name: "$_id", moms: 1 } },
        { $sort: { moms: -1 } },
      ]),
      Mom.aggregate([
        { $match: range },
        {
          $group: {
            _id: "$nationality",
            total: { $sum: 1 },
            withApp: { $sum: { $cond: [hasApp, 1, 0] } },
          },
        },
      ]),
      Mom.aggregate([
        { $match: range },
        {
          $group: {
            _id: "$createdBy",
            momsWithApp: { $sum: { $cond: [hasApp, 1, 0] } },
            installs: { $sum: appsSize },
          },
        },
        { $match: { installs: { $gt: 0 } } },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
        { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            name: {
              $trim: { input: { $concat: [{ $ifNull: ["$u.firstName", ""] }, " ", { $ifNull: ["$u.lastName", ""] }] } },
            },
            momsWithApp: 1,
            installs: 1,
          },
        },
        { $sort: { installs: -1 } },
      ]),
    ]);

    // Fold free-text nationality into canonical labels (several raw spellings
    // merge into one), keeping only labels that have at least one app install.
    const labelTotal = new Map<string, number>();
    const labelWithApp = new Map<string, number>();
    for (const row of natRaw as any[]) {
      const label = normalizeNationality(row._id);
      labelTotal.set(label, (labelTotal.get(label) || 0) + (row.total || 0));
      labelWithApp.set(label, (labelWithApp.get(label) || 0) + (row.withApp || 0));
    }
    const byNationality = Array.from(labelWithApp.entries())
      .filter(([, withApp]) => withApp > 0)
      .map(([label, withApp]) => {
        const total = labelTotal.get(label) || 0;
        return { label, withApp, total, rate: total > 0 ? Math.round((withApp / total) * 100) : 0 };
      })
      .sort((a, b) => b.withApp - a.withApp);

    const s = summaryAgg[0] || {};
    const totalMoms = s.totalMoms || 0;
    const momsWithApp = s.momsWithApp || 0;

    return NextResponse.json(
      {
        summary: {
          totalMoms,
          momsWithApp,
          totalInstalls: s.totalInstalls || 0,
          adoptionRate: totalMoms > 0 ? Math.round((momsWithApp / totalMoms) * 100) : 0,
        },
        byApp,
        byNationality,
        byEmployee,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute app adoption" }, { status: 500 });
  }
}
