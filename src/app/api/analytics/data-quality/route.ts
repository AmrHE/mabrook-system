/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Mom } from "@/models/Mom";
import { Visit } from "@/models/Visit";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

/** Data-hygiene counters for the selected range (+ currently open shifts). */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const inRange = { $gte: from, $lt: to };
    const excludedIds = await getExcludedUserIds();
    // Mom/Visit attribute to `createdBy`, Shift to `userId`.
    const byEmployee = excludeUsers("createdBy", excludedIds);
    const byShiftOwner = excludeUsers("userId", excludedIds);

    const [
      momsMissingPhone,
      momsMissingNationality,
      unsignedMoms,
      visitsWithZeroMoms,
      openShifts,
      dupAgg,
    ] = await Promise.all([
      Mom.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ phoneNumber: null }, { phoneNumber: "" }] }),
      Mom.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ nationality: null }, { nationality: "" }] }),
      Mom.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ signature: null }, { signature: "" }] }),
      Visit.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ moms: { $size: 0 } }, { moms: { $exists: false } }] }),
      Shift.countDocuments({ status: shiftStatus.IN_PROGRESS, ...byShiftOwner }),
      Mom.aggregate([
        { $match: { isActive: true, createdAt: inRange, ...byEmployee, phoneNumber: { $nin: ["", null] } } },
        { $group: { _id: "$phoneNumber", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: "dupes" },
      ]),
    ]);

    return NextResponse.json(
      {
        momsMissingPhone,
        momsMissingNationality,
        unsignedMoms,
        visitsWithZeroMoms,
        openShifts,
        duplicatePhones: dupAgg[0]?.dupes || 0,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute data quality" }, { status: 500 });
  }
}
