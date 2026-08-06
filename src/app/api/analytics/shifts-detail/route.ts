/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { shiftStatus } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { getSettings } from "@/utils/settings/getSettings";

export const dynamic = "force-dynamic";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * Per-shift rows enriched with duration, visits/moms/products counts, check-in /
 * check-out location, on-time flag, and auto-close info. Optional `?employeeId=`
 * narrows to one employee (used by the employee detail drill-down).
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);
    const settings = await getSettings();
    const toMin = toMinutes(settings.expectedStartTo);
    const lateThresholdMin = toMin + settings.graceMinutes;

    const employeeId = req.nextUrl.searchParams.get("employeeId");
    const match: Record<string, unknown> = { startTime: { $gte: from, $lt: to } };
    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      // An explicit per-employee drill-down is honoured as asked, even for an
      // excluded account — otherwise their own detail page would look empty.
      match.userId = new mongoose.Types.ObjectId(employeeId);
    } else {
      // Org-wide view: hold the internal/test accounts out.
      Object.assign(match, excludeUsers("userId", await getExcludedUserIds()));
    }

    const data = await Shift.aggregate([
      { $match: match },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "employee" } },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "visits", localField: "_id", foreignField: "shiftId", as: "visits" } },
      {
        $addFields: {
          visitsCount: { $size: "$visits" },
          momsCount: { $sum: { $map: { input: "$visits", as: "v", in: { $size: { $ifNull: ["$$v.moms", []] } } } } },
          visitIds: { $map: { input: "$visits", as: "v", in: "$$v._id" } },
        },
      },
      { $lookup: { from: "moms", localField: "visitIds", foreignField: "visitId", as: "shiftMoms" } },
      // Hospital coordinates anchor the geofence circle on the row's map. Two
      // lookups because a day can span hospitals: the top level needs its own,
      // and each session resolves against its own `hospitalId`.
      { $lookup: { from: "hospitals", localField: "hospitalId", foreignField: "_id", as: "hospitalDoc" } },
      { $lookup: { from: "hospitals", localField: "segments.hospitalId", foreignField: "_id", as: "segHospitals" } },
      {
        $addFields: {
          productsCount: { $sum: { $map: { input: "$shiftMoms", as: "m", in: { $size: { $ifNull: ["$$m.survey", []] } } } } },
          localMin: {
            $add: [
              { $multiply: [{ $hour: { date: "$startTime", timezone: TIMEZONE } }, 60] },
              { $minute: { date: "$startTime", timezone: TIMEZONE } },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          shiftId: { $toString: "$_id" },
          employeeId: { $toString: "$userId" },
          employee: {
            $trim: { input: { $concat: [{ $ifNull: ["$employee.firstName", ""] }, " ", { $ifNull: ["$employee.lastName", ""] }] } },
          },
          email: { $ifNull: ["$employee.email", ""] },
          status: 1,
          dayKey: {
            $ifNull: [
              "$dayKey",
              { $dateToString: { date: "$startTime", format: "%Y-%m-%d", timezone: TIMEZONE } },
            ],
          },
          startTime: 1,
          endTime: 1,
          sessionsCount: { $max: [1, { $size: { $ifNull: ["$segments", []] } }] },
          sessions: {
            $map: {
              input: { $ifNull: ["$segments", []] },
              as: "s",
              in: {
                startTime: "$$s.startTime",
                endTime: "$$s.endTime",
                autoClosed: "$$s.autoClosed",
                closeReason: "$$s.closeReason",
                startFenceStatus: "$$s.startFenceStatus",
                startDistanceMeters: "$$s.startDistanceMeters",
                // Needed by the check-in map: one pin per SESSION, not per day.
                startLocation: "$$s.startLocation",
                endLocation: "$$s.endLocation",
                hospitalLocation: {
                  $let: {
                    vars: {
                      h: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$segHospitals",
                              as: "h",
                              cond: { $eq: ["$$h._id", "$$s.hospitalId"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$h.location",
                  },
                },
              },
            },
          },
          // Summed sessions, not the day's span — the span would bill the gaps
          // between an employee's check-outs and check-ins.
          durationHours: {
            $cond: [
              { $gt: [{ $ifNull: ["$workedMinutes", 0] }, 0] },
              { $round: [{ $divide: ["$workedMinutes", 60] }, 1] },
              {
                $cond: [
                  { $and: [{ $eq: ["$status", shiftStatus.ENDED] }, { $ne: ["$endTime", null] }] },
                  { $round: [{ $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] }, 1] },
                  null,
                ],
              },
            ],
          },
          visitsCount: 1,
          momsCount: 1,
          productsCount: 1,
          startLocation: 1,
          endLocation: 1,
          hospitalLocation: { $arrayElemAt: ["$hospitalDoc.location", 0] },
          startFenceStatus: 1,
          startDistanceMeters: 1,
          autoClosed: { $ifNull: ["$autoClosed", false] },
          closeReason: 1,
          onTime: { $lte: ["$localMin", lateThresholdMin] },
          latenessMinutes: { $max: [0, { $subtract: ["$localMin", toMin] }] },
        },
      },
      { $sort: { startTime: -1 } },
    ]);

    return NextResponse.json({ data, settings }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute shifts detail" }, { status: 500 });
  }
}
