/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { shiftStatus } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

export const dynamic = "force-dynamic";

const DEFAULT_THRESHOLD_HOURS = 12;

/**
 * Forgot-to-end shifts: a session still running more than `?thresholdHours`
 * (default 12h) after it began. Not range-bound — these are always relevant.
 *
 * Elapsed time is measured from the CURRENT SESSION's start, not the day's first
 * check-in. Otherwise an employee who checked in at 09:00, checked out, and
 * resumed at 18:00 would be reported as having been on shift for nine hours the
 * moment they came back.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const thresholdParam = Number(req.nextUrl.searchParams.get("thresholdHours"));
    const thresholdHours = Number.isFinite(thresholdParam) && thresholdParam > 0 ? thresholdParam : DEFAULT_THRESHOLD_HOURS;

    const now = new Date();
    const cutoff = new Date(now.getTime() - thresholdHours * 3600000);

    const shifts = await Shift.find({
      status: shiftStatus.IN_PROGRESS,
      // Legacy rows have no `currentSegmentStartedAt`, so fall back to startTime.
      $or: [
        { currentSegmentStartedAt: { $lt: cutoff } },
        { currentSegmentStartedAt: { $exists: false }, startTime: { $lt: cutoff } },
      ],
      ...excludeUsers("userId", await getExcludedUserIds()),
    })
      .populate({ path: "userId", model: "User", select: "firstName lastName email" })
      .sort({ startTime: 1 })
      .lean();

    const data = (shifts as any[]).map((s) => {
      const openSince = s.currentSegmentStartedAt ?? s.startTime;
      return {
        shiftId: String(s._id),
        employeeName: s.userId
          ? `${s.userId.firstName ?? ""} ${s.userId.lastName ?? ""}`.trim() || "غير محدد"
          : "غير محدد",
        email: s.userId?.email ?? "",
        startTime: s.startTime,
        dayKey: s.dayKey ?? "",
        openSince,
        sessionsCount: Math.max(1, s.segments?.length ?? 1),
        elapsedHours: Math.round(((now.getTime() - new Date(openSince).getTime()) / 3600000) * 10) / 10,
      };
    });

    return NextResponse.json({ thresholdHours, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to compute open shifts" }, { status: 500 });
  }
}
