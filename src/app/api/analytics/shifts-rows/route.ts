/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { parseRange, TIMEZONE } from "@/utils/date/range";
import { shiftStatus, shiftCloseReason, userRoles } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

const fmt = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }) : "";

const CLOSE_REASON_AR: Record<string, string> = {
  [shiftCloseReason.MANUAL]: "يدوي",
  [shiftCloseReason.LOGOUT]: "تسجيل خروج",
  [shiftCloseReason.MAX_DURATION]: "تجاوز المدة",
  [shiftCloseReason.INACTIVITY]: "خمول",
  [shiftCloseReason.DUPLICATE]: "مكرر",
};

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
          startTime: 1,
          endTime: 1,
          lastActivityAt: 1,
          durationHours: {
            $cond: [
              { $and: [{ $eq: ["$status", shiftStatus.ENDED] }, { $ne: ["$endTime", null] }] },
              { $round: [{ $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] }, 1] },
              null,
            ],
          },
          visitsCount: 1,
          momsCount: 1,
          startLocation: 1,
          endLocation: 1,
          autoClosed: { $ifNull: ["$autoClosed", false] },
          closeReason: 1,
          forgotToEnd: { $cond: [{ $eq: ["$status", shiftStatus.IN_PROGRESS] }, "نعم", "لا"] },
        },
      },
      { $sort: { startTime: -1 } },
    ]);

    const rows = (agg as any[]).map((r) => ({
      employee: r.employee || "غير محدد",
      email: r.email,
      startTime: fmt(r.startTime),
      endTime: fmt(r.endTime),
      durationHours: r.durationHours ?? "",
      visitsCount: r.visitsCount ?? 0,
      momsCount: r.momsCount ?? 0,
      startLocation: coord(r.startLocation),
      endLocation: coord(r.endLocation),
      startLoc: rawCoord(r.startLocation),
      endLoc: rawCoord(r.endLocation),
      autoClosed: r.autoClosed ? "نعم" : "لا",
      closeReason: r.closeReason ? CLOSE_REASON_AR[r.closeReason] ?? r.closeReason : "",
      lastActivityAt: fmt(r.lastActivityAt),
      forgotToEnd: r.forgotToEnd,
    }));

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute shifts rows" }, { status: 500 });
  }
}
