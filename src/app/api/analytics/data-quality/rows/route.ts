/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Mom } from "@/models/Mom";
import { Visit } from "@/models/Visit";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { normalizeNationality } from "@/utils/nationality/normalize";
import { DQ_BY_SLUG } from "@/utils/analytics/dataQualityCategories";

export const dynamic = "force-dynamic";

const fmt = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }) : "";

/** The moms-rows join/projection, parameterised by the leading $match. */
const momPipeline = (match: Record<string, any>) => [
  { $match: match },
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
      createdAt: 1,
    },
  },
  { $sort: { createdAt: -1 as const } },
];

const mapMomRow = (r: any) => ({
  name: r.name,
  nationality: normalizeNationality(r.nationalityRaw),
  phoneNumber: r.phoneNumber,
  hospital: r.hospital,
  city: r.city,
  employee: r.employee,
  createdAt: fmt(r.createdAt),
});

/**
 * Row-level drill-down behind the data-quality panel: returns the offending
 * records for one category. Mirrors the count route's $match clauses exactly
 * so the table agrees with the panel number (duplicate-phones excepted: the
 * panel counts distinct phone values, this returns the individual moms).
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const category = req.nextUrl.searchParams.get("category") ?? "";
  const cfg = DQ_BY_SLUG[category];
  if (!cfg) return NextResponse.json({ status: 400, message: "Unknown category" }, { status: 400 });

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const inRange = { $gte: from, $lt: to };
    const excludedIds = await getExcludedUserIds();
    // Mom/Visit attribute to `createdBy`, Shift to `userId`.
    const byEmployee = excludeUsers("createdBy", excludedIds);
    const byShiftOwner = excludeUsers("userId", excludedIds);
    let rows: any[] = [];

    switch (cfg.slug) {
      case "moms-missing-phone": {
        const agg = await Mom.aggregate(
          momPipeline({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ phoneNumber: null }, { phoneNumber: "" }] }),
        );
        rows = (agg as any[]).map(mapMomRow);
        break;
      }

      case "moms-missing-nationality": {
        const agg = await Mom.aggregate(
          momPipeline({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ nationality: null }, { nationality: "" }] }),
        );
        // Keep the raw (empty) nationality visible instead of folding it to "غير محدد".
        rows = (agg as any[]).map((r) => ({ ...mapMomRow(r), nationality: r.nationalityRaw }));
        break;
      }

      case "unsigned-moms": {
        const agg = await Mom.aggregate(
          momPipeline({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ signature: null }, { signature: "" }] }),
        );
        rows = (agg as any[]).map(mapMomRow);
        break;
      }

      case "duplicate-phones": {
        const agg = await Mom.aggregate([
          { $match: { isActive: true, createdAt: inRange, ...byEmployee, phoneNumber: { $nin: ["", null] } } },
          { $group: { _id: "$phoneNumber", count: { $sum: 1 }, moms: { $push: "$$ROOT" } } },
          { $match: { count: { $gt: 1 } } },
          { $unwind: "$moms" },
          { $replaceRoot: { newRoot: { $mergeObjects: ["$moms", { dupCount: "$count" }] } } },
          { $lookup: { from: "visits", localField: "visitId", foreignField: "_id", as: "visit" } },
          { $unwind: { path: "$visit", preserveNullAndEmptyArrays: true } },
          { $lookup: { from: "hospitals", localField: "visit.hospitalId", foreignField: "_id", as: "hospital" } },
          { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
          { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "employee" } },
          { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              phoneNumber: 1,
              dupCount: 1,
              name: { $ifNull: ["$name", ""] },
              nationalityRaw: { $ifNull: ["$nationality", ""] },
              hospital: { $ifNull: ["$hospital.name", "غير محدد"] },
              city: { $ifNull: ["$hospital.city", ""] },
              employee: {
                $trim: { input: { $concat: [{ $ifNull: ["$employee.firstName", ""] }, " ", { $ifNull: ["$employee.lastName", ""] }] } },
              },
              createdAt: 1,
            },
          },
          // Keep records sharing a phone adjacent in the table.
          { $sort: { phoneNumber: 1, createdAt: 1 } },
        ]);
        rows = (agg as any[]).map((r) => ({
          phoneNumber: r.phoneNumber,
          dupCount: r.dupCount,
          name: r.name,
          nationality: normalizeNationality(r.nationalityRaw),
          hospital: r.hospital,
          city: r.city,
          employee: r.employee,
          createdAt: fmt(r.createdAt),
        }));
        break;
      }

      case "visits-without-moms": {
        const agg = await Visit.aggregate([
          { $match: { isActive: true, createdAt: inRange, ...byEmployee, $or: [{ moms: { $size: 0 } }, { moms: { $exists: false } }] } },
          { $lookup: { from: "hospitals", localField: "hospitalId", foreignField: "_id", as: "hospital" } },
          { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
          { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "employee" } },
          { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              hospital: { $ifNull: ["$hospital.name", "غير محدد"] },
              city: { $ifNull: ["$hospital.city", ""] },
              employee: {
                $trim: { input: { $concat: [{ $ifNull: ["$employee.firstName", ""] }, " ", { $ifNull: ["$employee.lastName", ""] }] } },
              },
              status: 1,
              createdAt: 1,
            },
          },
          { $sort: { createdAt: -1 } },
        ]);
        rows = (agg as any[]).map((r) => ({
          hospital: r.hospital,
          city: r.city,
          employee: r.employee,
          status: r.status === shiftStatus.IN_PROGRESS ? "جارية" : r.status === shiftStatus.ENDED ? "منتهية" : r.status || "",
          createdAt: fmt(r.createdAt),
        }));
        break;
      }

      case "open-shifts": {
        // Deliberately not range-bound, matching the panel's global count.
        const now = new Date();
        const shifts = await Shift.find({ status: shiftStatus.IN_PROGRESS, ...byShiftOwner })
          .populate({ path: "userId", model: "User", select: "firstName lastName email" })
          .sort({ startTime: 1 })
          .lean();
        rows = (shifts as any[]).map((s) => ({
          employee: s.userId ? `${s.userId.firstName ?? ""} ${s.userId.lastName ?? ""}`.trim() || "غير محدد" : "غير محدد",
          email: s.userId?.email ?? "",
          startTime: fmt(s.startTime),
          elapsedHours: Math.round(((now.getTime() - new Date(s.startTime).getTime()) / 3600000) * 10) / 10,
        }));
        break;
      }
    }

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute data quality rows" }, { status: 500 });
  }
}
