/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { Mom } from "@/models/Mom";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { normalizeNationality } from "@/utils/nationality/normalize";

export const dynamic = "force-dynamic";

/** Flattened mom rows (+ hospital + employee) for the Moms report CSV. */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const excludedIds = await getExcludedUserIds();

    const agg = await Mom.aggregate([
      { $match: { isActive: true, createdAt: { $gte: from, $lt: to }, ...excludeUsers("createdBy", excludedIds) } },
      { $lookup: { from: "visits", localField: "visitId", foreignField: "_id", as: "visit" } },
      { $unwind: { path: "$visit", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "hospitals", localField: "visit.hospitalId", foreignField: "_id", as: "hospital" } },
      { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "employee" } },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ["$name", ""] },
          nationalityRaw: { $ifNull: ["$nationality", ""] },
          phoneNumber: { $ifNull: ["$phoneNumber", ""] },
          hospital: { $ifNull: ["$hospital.name", "غير محدد"] },
          city: { $ifNull: ["$hospital.city", ""] },
          employee: {
            $trim: { input: { $concat: [{ $ifNull: ["$employee.firstName", ""] }, " ", { $ifNull: ["$employee.lastName", ""] }] } },
          },
          numberOfKids: { $ifNull: ["$numberOfKids", 0] },
          numberOfnewborns: { $ifNull: ["$numberOfnewborns", 0] },
          numberOfMales: { $ifNull: ["$numberOfMales", 0] },
          numberOfFemales: { $ifNull: ["$numberOfFemales", 0] },
          twins: { $cond: [{ $gte: [{ $ifNull: ["$numberOfnewborns", 0] }, 2] }, "نعم", "لا"] },
          consent: { $cond: ["$allowFutureCom", "نعم", "لا"] },
          signature: {
            $cond: [{ $and: [{ $ne: ["$signature", ""] }, { $ne: ["$signature", null] }] }, "نعم", "لا"],
          },
          installedApps: { $ifNull: ["$installedApp", []] },
          appInstalled: { $cond: [{ $gt: [{ $size: { $ifNull: ["$installedApp", []] } }, 0] }, "نعم", "لا"] },
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    const rows = (agg as any[]).map((r) => ({
      name: r.name,
      nationality: normalizeNationality(r.nationalityRaw),
      phoneNumber: r.phoneNumber,
      hospital: r.hospital,
      city: r.city,
      employee: r.employee,
      numberOfKids: r.numberOfKids,
      numberOfnewborns: r.numberOfnewborns,
      numberOfMales: r.numberOfMales,
      numberOfFemales: r.numberOfFemales,
      twins: r.twins,
      consent: r.consent,
      signature: r.signature,
      appInstalled: r.appInstalled,
      installedApps: Array.isArray(r.installedApps) ? r.installedApps.join("، ") : "",
      createdAt: r.createdAt
        ? new Date(r.createdAt).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" })
        : "",
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute moms rows" }, { status: 500 });
  }
}
