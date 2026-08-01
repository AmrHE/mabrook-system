/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Shift } from "@/models/Shift";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { User } from "@/models/User";
import { riyadhDayKey } from "@/utils/date/range";
import { applyShiftRollups } from "@/utils/shift/rollup";

/** Only keep a coordinate pair when both values are finite numbers. */
function sanitizeLocation(loc: unknown): { lat: number; lng: number } | undefined {
  const l = loc as { lat?: unknown; lng?: unknown } | null | undefined;
  if (l && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))) {
    return { lat: Number(l.lat), lng: Number(l.lng) };
  }
  return undefined;
}

/**
 * End the running SESSION of today's shift.
 *
 * The shift document stays — it is the day's container — and the employee can
 * append another session later with "استئناف الدوام". Only the open segment is
 * closed, and `workedMinutes` grows by that segment alone, so the gap until the
 * next check-in is never billed.
 */
export async function POST(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const body = await req.json().catch(() => ({}));
  const endLocation = sanitizeLocation(body?.location);

  const now = new Date();
  const todayKey = riyadhDayKey(now);

  // Legacy safety net: before the {userId, dayKey} unique index exists a user
  // may still hold several open shifts. Once it does, `duplicatesClosed` must
  // always be 0 — this is a tripwire, not a mechanism.
  const open: any[] = await Shift.find({
    userId: userPayload._id,
    status: shiftStatus.IN_PROGRESS,
  }).sort({ startTime: -1 });

  if (open.length === 0) {
    // Idempotent: a second press (or a second tab) finds today's shift already
    // closed and gets a 200 with it, rather than a confusing 404.
    const alreadyEnded = await Shift.findOne({
      userId: userPayload._id,
      dayKey: todayKey,
      status: shiftStatus.ENDED,
    });
    if (alreadyEnded) {
      return NextResponse.json({ message: "Shift already ended", shift: alreadyEnded }, { status: 200 });
    }
    return NextResponse.json({status: 404, message: "No shift is currently opened! please start a new shift"})
  }

  const [current, ...stragglers] = open;

  const segments = current.segments ?? [];
  const openIndex = segments.findIndex((s: any) => !s.endTime);
  if (openIndex >= 0) {
    segments[openIndex].endTime = now;
    segments[openIndex].endLocation = endLocation;
    segments[openIndex].autoClosed = false;
    segments[openIndex].closeReason = shiftCloseReason.MANUAL;
    applyShiftRollups(current);
  } else {
    // A shift with no open segment should never be IN_PROGRESS. Repair it
    // rather than leaving the employee stuck on a button that does nothing.
    current.status = shiftStatus.ENDED;
    current.endTime = current.endTime ?? now;
    current.currentSegmentStartedAt = undefined;
  }
  await current.save();

  let duplicatesClosed = 0;
  for (const s of stragglers) {
    const segs = s.segments ?? [];
    const idx = segs.findIndex((seg: any) => !seg.endTime);
    if (idx >= 0) {
      segs[idx].endTime = s.lastActivityAt ?? segs[idx].startTime;
      segs[idx].autoClosed = true;
      segs[idx].closeReason = shiftCloseReason.DUPLICATE;
      applyShiftRollups(s);
    }
    s.status = shiftStatus.ENDED;
    await s.save();
    duplicatesClosed++;
  }
  if (duplicatesClosed > 0) {
    console.warn(
      `endShift: closed ${duplicatesClosed} duplicate open shift(s) for user ${userPayload._id} — the {userId, dayKey} unique index is missing or was dropped`,
    );
  }

  const user = await User.findById(userPayload._id);
  if (user) {
    user.isOnShift = false;
    await user.save();
  }

  return NextResponse.json({ message: "Shift Ended", shift: current }, { status: 200 });
}
