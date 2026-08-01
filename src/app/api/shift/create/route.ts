/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Shift } from "@/models/Shift";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { User } from "@/models/User";
import { Hospital } from "@/models/Hospital";
import { getSettings } from "@/utils/settings/getSettings";
import { evaluateFence, type FenceResult, type LatLng } from "@/utils/geo/geofence";
import { riyadhDayKey } from "@/utils/date/range";
import { buildSegment, segmentMinutes } from "@/utils/shift/rollup";
import { effectiveActivityMs, loadActivitySignals } from "@/utils/shift/lastActivity";

/** Only keep a coordinate pair when both values are finite numbers. */
function sanitizeLocation(loc: unknown): { lat: number; lng: number } | undefined {
  const l = loc as { lat?: unknown; lng?: unknown } | null | undefined;
  if (l && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))) {
    return { lat: Number(l.lat), lng: Number(l.lng) };
  }
  return undefined;
}

/**
 * Classify a check-in against the chosen hospital's coordinates (soft — never
 * blocks). Returns undefined when no hospital was picked (older clients).
 */
async function computeFence(loc: LatLng | undefined, hospitalId: string | undefined): Promise<FenceResult | undefined> {
  if (!hospitalId) return undefined;
  const [hospital, settings] = await Promise.all([
    Hospital.findById(hospitalId).select("location"),
    getSettings(),
  ]);
  return evaluateFence(loc, hospital?.location, settings.geofenceRadiusMeters);
}

/**
 * Close any shift left open from an EARLIER Riyadh day.
 *
 * Without this, an employee who forgot to check out at 23:30 would hold two
 * open shifts the next morning — the unique index is per day, so it permits it —
 * breaking the "at most one open shift" invariant that getCurrentShift,
 * endShift, isOnShift and the data-quality panel all rely on.
 *
 * The close instant is the session's effective last activity, so an abandoned
 * night never bills idle hours.
 */
async function closeStaleDays(userId: string, todayKey: string, now: Date): Promise<void> {
  const stale: any[] = await Shift.find({
    userId,
    status: shiftStatus.IN_PROGRESS,
    $or: [{ dayKey: { $ne: todayKey } }, { dayKey: { $exists: false } }],
  });
  if (!stale.length) return;

  const { visitMax, momMax } = await loadActivitySignals(stale.map((s) => s._id));
  const nowMs = now.getTime();

  for (const shift of stale) {
    const segments = shift.segments ?? [];
    const openIndex = segments.findIndex((s: any) => !s.endTime);
    const openStart = openIndex >= 0 ? segments[openIndex].startTime : shift.startTime;
    const sid = String(shift._id);

    const endTime = new Date(
      effectiveActivityMs({
        openStartMs: new Date(openStart).getTime(),
        lastActivityAt: shift.lastActivityAt,
        visitMax: visitMax.get(sid),
        momMax: momMax.get(sid),
        nowMs,
      }),
    );

    if (openIndex >= 0) {
      segments[openIndex].endTime = endTime;
      segments[openIndex].autoClosed = true;
      segments[openIndex].closeReason = shiftCloseReason.DAY_ROLLOVER;
      shift.workedMinutes = (shift.workedMinutes ?? 0) + segmentMinutes(segments[openIndex]);
    }

    shift.status = shiftStatus.ENDED;
    shift.endTime = endTime;
    shift.autoClosed = true;
    shift.closeReason = shiftCloseReason.DAY_ROLLOVER;
    shift.currentSegmentStartedAt = undefined;
    await shift.save();
  }
}

/**
 * Start — or resume — today's shift.
 *
 * There is exactly ONE shift document per employee per Riyadh day. Pressing
 * "start" while today's shift is open returns it; pressing it after checking
 * out appends a new session to the same document. That is what makes an
 * interrupted day (browser closed, phone died, cron auto-close) recoverable
 * without fragmenting the record.
 *
 * Written as a compare-and-swap loop rather than read-then-write, so two tabs
 * pressing the button at once cannot produce two shifts.
 */
export async function POST(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  // Body is optional (older clients send none) — tolerate a missing/empty body.
  const body = await req.json().catch(() => ({}));
  const startLocation = sanitizeLocation(body?.location);
  const hospitalId = typeof body?.hospitalId === "string" ? body.hospitalId : undefined;

  const user = await User.findById(userPayload._id);
  if (!user) {
    return NextResponse.json({ status: 404, message: "User not found" });
  }

  const now = new Date();
  const todayKey = riyadhDayKey(now);

  await closeStaleDays(userPayload._id, todayKey, now);

  const fence = await computeFence(startLocation, hospitalId);

  for (let attempt = 0; attempt < 3; attempt++) {
    // (1) Today's shift is already running — idempotent, plus the backfill of
    //     check-in details that older clients omitted.
    const running: any = await Shift.findOne({
      userId: userPayload._id,
      dayKey: todayKey,
      status: shiftStatus.IN_PROGRESS,
    });
    if (running) {
      const segments = running.segments ?? [];
      const open = segments.find((s: any) => !s.endTime);
      let changed = false;

      if (open) {
        if (startLocation && !open.startLocation?.lat) {
          open.startLocation = startLocation;
          if (!running.startLocation?.lat) running.startLocation = startLocation;
          changed = true;
        }
        if (hospitalId && !open.hospitalId) {
          open.hospitalId = hospitalId;
          if (!running.hospitalId) running.hospitalId = hospitalId;
          changed = true;
        }
        if (!open.startFenceStatus && fence) {
          open.startFenceStatus = fence.status;
          open.startDistanceMeters = fence.distanceMeters ?? undefined;
          if (!running.startFenceStatus) {
            running.startFenceStatus = fence.status;
            running.startDistanceMeters = fence.distanceMeters ?? undefined;
          }
          changed = true;
        }
      }
      if (changed) await running.save();
      if (!user.isOnShift) {
        user.isOnShift = true;
        await user.save();
      }

      return NextResponse.json(
        { message: "Shift already in progress", shift: running, segment: open, resumed: false },
        { status: 200 },
      );
    }

    const segment = buildSegment({
      startTime: now,
      hospitalId,
      startLocation,
      startFenceStatus: fence?.status,
      startDistanceMeters: fence?.distanceMeters ?? undefined,
    });

    // (2) Today's shift exists but was closed — append a session.
    //     `status: ENDED` in the filter IS the compare-and-swap: whichever tab
    //     flips it first wins, and the loser falls through to branch (1) next
    //     iteration and gets the same shift. A duplicate-key error is
    //     impossible here because this is an update, not an insert.
    const resumed: any = await Shift.findOneAndUpdate(
      { userId: userPayload._id, dayKey: todayKey, status: shiftStatus.ENDED },
      {
        $push: { segments: segment },
        $inc: { sessionsCount: 1 },
        $set: {
          status: shiftStatus.IN_PROGRESS,
          currentSegmentStartedAt: now,
          lastActivityAt: now,
          autoClosed: false,
        },
        $unset: { endTime: "", endLocation: "", closeReason: "" },
      },
      { new: true },
    );
    if (resumed) {
      if (!user.isOnShift) {
        user.isOnShift = true;
        await user.save();
      }
      return NextResponse.json(
        {
          message: "Shift resumed",
          shift: resumed,
          segment: resumed.segments[resumed.segments.length - 1],
          resumed: true,
        },
        { status: 200 },
      );
    }

    // (3) First check-in of the day.
    try {
      const created = await Shift.create({
        userId: userPayload._id,
        dayKey: todayKey,
        segments: [segment],
        sessionsCount: 1,
        workedMinutes: 0,
        currentSegmentStartedAt: now,
        startTime: now,
        status: shiftStatus.IN_PROGRESS,
        lastActivityAt: now,
        startLocation,
        hospitalId: hospitalId || undefined,
        startFenceStatus: fence?.status,
        startDistanceMeters: fence?.distanceMeters ?? undefined,
      });

      user.shifts.push(created._id);
      user.isOnShift = true;
      await user.save();

      return NextResponse.json(
        { message: "Shift Started", shift: created, segment: created.segments[0], resumed: false },
        { status: 201 },
      );
    } catch (err) {
      // 11000 = the {userId, dayKey} unique index; a concurrent request won the
      // insert. Loop round — branch (1) or (2) will now match it.
      if ((err as { code?: number })?.code === 11000) continue;
      throw err;
    }
  }

  return NextResponse.json(
    { status: 409, message: "تعذّر بدء الدوام بسبب تعارض. حاول مرة أخرى." },
    { status: 409 },
  );
}
