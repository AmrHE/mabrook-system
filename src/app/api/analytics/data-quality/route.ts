/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, riyadhDayKey } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Mom } from "@/models/Mom";
import { Visit } from "@/models/Visit";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { getMomRateBaseline, lowMomRateFilter } from "@/utils/analytics/visitProductivity";

export const dynamic = "force-dynamic";

/** Data-hygiene counters for the selected range (+ currently open shifts). */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const inRange = { $gte: from, $lt: to };
    // The baseline is its own aggregation, so kick it off alongside the
    // excluded-account lookup rather than serialising the two.
    const [excludedIds, momRateBaseline] = await Promise.all([
      getExcludedUserIds(),
      getMomRateBaseline(),
    ]);
    // Mom/Visit attribute to `createdBy`, Shift to `userId`.
    const byEmployee = excludeUsers("createdBy", excludedIds);
    const byShiftOwner = excludeUsers("userId", excludedIds);

    const [
      momsMissingPhone,
      momsMissingNationality,
      unsignedMoms,
      visitsWithZeroMoms,
      lowMomRateVisits,
      openShifts,
      dupAgg,
    ] = await Promise.all([
      Mom.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ phoneNumber: null }, { phoneNumber: "" }] }),
      Mom.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ nationality: null }, { nationality: "" }] }),
      Mom.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ signature: null }, { signature: "" }] }),
      Visit.countDocuments({ isActive: true, createdAt: inRange, ...byEmployee, $or: [{ moms: { $size: 0 } }, { moms: { $exists: false } }] }),
      // Same filter object the rows route uses — that's what keeps this count
      // and the drill-down table in agreement.
      Visit.countDocuments(lowMomRateFilter(momRateBaseline, { createdAt: inRange, ...byEmployee })),
      // Only shifts left open from a PAST day. Now that a shift spans a whole
      // day, "currently open" mostly means "people are at work right now",
      // which is not a data-quality defect; a day that never got closed is.
      Shift.countDocuments({
        status: shiftStatus.IN_PROGRESS,
        ...byShiftOwner,
        $or: [{ dayKey: { $lt: riyadhDayKey(new Date()) } }, { dayKey: { $exists: false } }],
      }),
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
        lowMomRateVisits,
        openShifts,
        duplicatePhones: dupAgg[0]?.dupes || 0,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute data quality" }, { status: 500 });
  }
}
