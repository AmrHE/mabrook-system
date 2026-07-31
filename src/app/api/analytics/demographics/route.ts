/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { isSaudi, normalizeNationality, UNKNOWN_LABEL } from "@/utils/nationality/normalize";

export const dynamic = "force-dynamic";

/**
 * Nationality is free text, so we group the raw values in Mongo and fold the
 * variants in JS. Gender / multiple-births / kids-per-mom come from parallel
 * groups in the same range.
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

    // Maternal age buckets. `$bucket` _id is the lower boundary of each group.
    const AGE_GROUPS = [
      { min: 0, label: "أقل من 20" },
      { min: 20, label: "20-24" },
      { min: 25, label: "25-29" },
      { min: 30, label: "30-34" },
      { min: 35, label: "35-39" },
      { min: 40, label: "40 فأكثر" },
    ];

    const [natRaw, statsAgg, kidsAgg, ageAgg] = await Promise.all([
      Mom.aggregate([
        { $match: range },
        {
          $group: {
            _id: "$nationality",
            count: { $sum: 1 },
            consent: { $sum: { $cond: ["$allowFutureCom", 1, 0] } },
          },
        },
      ]),
      Mom.aggregate([
        { $match: range },
        {
          $group: {
            _id: null,
            males: { $sum: { $ifNull: ["$numberOfMales", 0] } },
            females: { $sum: { $ifNull: ["$numberOfFemales", 0] } },
            singletons: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$numberOfnewborns", 0] }, 1] }, 1, 0] } },
            twins: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$numberOfnewborns", 0] }, 2] }, 1, 0] } },
            tripletsPlus: { $sum: { $cond: [{ $gte: [{ $ifNull: ["$numberOfnewborns", 0] }, 3] }, 1, 0] } },
          },
        },
      ]),
      Mom.aggregate([
        { $match: range },
        { $group: { _id: { $ifNull: ["$numberOfKids", 0] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, kids: "$_id", count: 1 } },
      ]),
      Mom.aggregate([
        { $match: { ...range, age: { $ne: null, $gte: 0 } } },
        {
          $bucket: {
            groupBy: "$age",
            boundaries: [0, 20, 25, 30, 35, 40, 200],
            default: "other",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
    ]);

    // Dense age-group array (fills zero-count groups so the chart is stable).
    const ageBucketMap = new Map<number, number>((ageAgg as any[]).map((b) => [b._id, b.count]));
    const ageGroups = AGE_GROUPS.map((g) => ({ label: g.label, count: ageBucketMap.get(g.min) || 0 }));

    // Fold free-text nationality into Saudi / non-Saudi + per-label breakdown.
    // Consent is summed per label and divided only after folding, since several
    // raw spellings merge into one label.
    let saudi = 0;
    let nonSaudi = 0;
    let unknown = 0;
    const labelCounts = new Map<string, number>();
    const labelConsent = new Map<string, number>();

    for (const row of natRaw as any[]) {
      const count = row.count || 0;
      const label = normalizeNationality(row._id);
      labelCounts.set(label, (labelCounts.get(label) || 0) + count);
      labelConsent.set(label, (labelConsent.get(label) || 0) + (row.consent || 0));

      if (label === UNKNOWN_LABEL) unknown += count;
      else if (isSaudi(row._id)) saudi += count;
      else nonSaudi += count;
    }

    const breakdown = Array.from(labelCounts.entries())
      .map(([label, count]) => ({
        label,
        count,
        futureContactRate: count > 0 ? Math.round(((labelConsent.get(label) || 0) / count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const s = statsAgg[0] || {};

    return NextResponse.json(
      {
        nationality: { saudi, nonSaudi, unknown, breakdown },
        gender: { males: s.males || 0, females: s.females || 0 },
        births: { singletons: s.singletons || 0, twins: s.twins || 0, tripletsPlus: s.tripletsPlus || 0 },
        kidsPerMom: kidsAgg,
        ageGroups,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute demographics" }, { status: 500 });
  }
}
