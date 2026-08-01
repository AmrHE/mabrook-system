/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { shiftStatus, userRoles } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";
import { closeReasonLabel, formatSessionSpan } from "@/utils/shift/labels";
import { riyadhDayKey } from "@/utils/date/range";

export const dynamic = "force-dynamic";

const fmt = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }) : "";

const coord = (loc: any) =>
  loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? `${loc.lat}, ${loc.lng}` : "";

const rawCoord = (loc: any) =>
  loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? { lat: loc.lat, lng: loc.lng } : null;

/** Flattened shift rows (+ employee, duration, forgot-to-end flag) for CSV. */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const { from, to } = parseRange(req.nextUrl.searchParams);

    // Admins see every shift; any other role is scoped to their own shifts.
    const match: Record<string, unknown> = { startTime: { $gte: from, $lt: to } };
    if (payload.role !== userRoles.ADMIN) {
      // Self-scoped, so the exclusion must NOT apply — an excluded account still
      // sees its own shifts.
      match.userId = new mongoose.Types.ObjectId(payload._id);
    } else {
      Object.assign(match, excludeUsers("userId", await getExcludedUserIds()));
    }

    const agg = await Shift.aggregate([
      { $match: match },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "employee" } },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "visits", localField: "_id", foreignField: "shiftId", as: "visits" } },
      {
        $addFields: {
          visitsCount: { $size: "$visits" },
          momsCount: { $sum: { $map: { input: "$visits", as: "v", in: { $size: { $ifNull: ["$$v.moms", []] } } } } },
        },
      },
      {
        $project: {
          _id: 0,
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
          lastActivityAt: 1,
          segments: { $ifNull: ["$segments", []] },
          sessionsCount: { $max: [1, { $size: { $ifNull: ["$segments", []] } }] },
          // Summed sessions, not the day's span. A day worked 09:00-12:00 and
          // 16:00-19:00 is 6 hours, not the 10 the span would report.
          workedMinutes: {
            $cond: [
              { $gt: [{ $ifNull: ["$workedMinutes", 0] }, 0] },
              "$workedMinutes",
              {
                $cond: [
                  { $and: [{ $eq: ["$status", shiftStatus.ENDED] }, { $ne: ["$endTime", null] }] },
                  { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 60000] },
                  null,
                ],
              },
            ],
          },
          // Wall-clock span minus worked time = the unpaid gap between sessions.
          spanMinutes: {
            $cond: [
              { $ne: ["$endTime", null] },
              { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 60000] },
              null,
            ],
          },
          visitsCount: 1,
          momsCount: 1,
          startLocation: 1,
          endLocation: 1,
          autoClosed: { $ifNull: ["$autoClosed", false] },
          autoClosedSessions: {
            $size: {
              $filter: {
                input: { $ifNull: ["$segments", []] },
                as: "s",
                cond: { $eq: ["$$s.autoClosed", true] },
              },
            },
          },
          closeReason: 1,
          forgotToEnd: { $cond: [{ $eq: ["$status", shiftStatus.IN_PROGRESS] }, "نعم", "لا"] },
        },
      },
      { $sort: { startTime: -1 } },
    ]);

    const todayKey = riyadhDayKey(new Date());

    const rows = (agg as any[]).map((r) => {
      const worked = r.workedMinutes;
      const breakMinutes =
        r.spanMinutes != null && worked != null ? Math.max(0, Math.round(r.spanMinutes - worked)) : "";

      return {
        employee: r.employee || "غير محدد",
        email: r.email,
        dayKey: r.dayKey ?? "",
        startTime: fmt(r.startTime),
        endTime: fmt(r.endTime),
        durationHours: worked != null ? Math.round((worked / 60) * 10) / 10 : "",
        sessionsCount: r.sessionsCount ?? 1,
        breakMinutes,
        // Flattened so the sessions survive CSV export, which is what admins
        // actually consume; the UI renders the structured `sessions` instead.
        sessionsText: (r.segments ?? [])
          .map((s: any) => formatSessionSpan(s.startTime, s.endTime))
          .join(" | "),
        sessions: (r.segments ?? []).map((s: any) => ({
          startTime: s.startTime,
          endTime: s.endTime ?? null,
          autoClosed: !!s.autoClosed,
          closeReason: closeReasonLabel(s.closeReason),
          startLoc: rawCoord(s.startLocation),
          endLoc: rawCoord(s.endLocation),
        })),
        visitsCount: r.visitsCount ?? 0,
        momsCount: r.momsCount ?? 0,
        startLocation: coord(r.startLocation),
        endLocation: coord(r.endLocation),
        startLoc: rawCoord(r.startLocation),
        endLoc: rawCoord(r.endLocation),
        autoClosed: r.autoClosed ? "نعم" : "لا",
        autoClosedSessions: r.autoClosedSessions ?? 0,
        closeReason: closeReasonLabel(r.closeReason),
        lastActivityAt: fmt(r.lastActivityAt),
        // Still open is normal during working hours — what deserves attention is
        // a day left open after it ended.
        forgotToEnd: r.forgotToEnd,
        staleOpen: r.status === shiftStatus.IN_PROGRESS && r.dayKey < todayKey ? "نعم" : "لا",
      };
    });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute shifts rows" }, { status: 500 });
  }
}
