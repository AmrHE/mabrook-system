/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Visit } from "@/models/Visit";
import { Shift } from "@/models/Shift";
import { Hospital } from "@/models/Hospital";
import { shiftStatus } from "@/models/enum.constants";
import { riyadhDayKey } from "@/utils/date/range";
import { getSettings } from "@/utils/settings/getSettings";
import { evaluateFence } from "@/utils/geo/geofence";
import { applyVisitRollups } from "@/utils/visit/rollup";

/** Only keep a coordinate pair when both values are finite numbers. */
function sanitizeLocation(loc: unknown): { lat: number; lng: number } | undefined {
  const l = loc as { lat?: unknown; lng?: unknown } | null | undefined;
  if (l && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))) {
    return { lat: Number(l.lat), lng: Number(l.lng) };
  }
  return undefined;
}

/**
 * Reopen an ended visit as a new session.
 *
 * A separate route rather than a branch of `visit/create`, because create's
 * contract is "start a NEW visit at the hospital I just picked" — silently
 * reopening an old record there would be a surprising side effect. (A shift is
 * different: a day-shift genuinely is a singleton per day, so idempotency is
 * natural.) Reopening also mutates an already-reported duration, which deserves
 * its own auditable endpoint.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  const body = await req.json().catch(() => ({}));
  const startLocation = sanitizeLocation(body?.startLocation);

  const visit: any = await Visit.findById(id);
  if (!visit || visit.isActive === false) {
    return NextResponse.json({ status: 404, message: "Visit not found" }, { status: 404 });
  }

  if (String(visit.createdBy) !== String(userPayload._id)) {
    return NextResponse.json(
      { status: 403, message: "لا يمكنك متابعة زيارة يملكها موظف آخر" },
      { status: 403 },
    );
  }

  if (visit.status === shiftStatus.IN_PROGRESS) {
    // Already open — nothing to do, just let the client navigate into it.
    return NextResponse.json({ message: "Visit already open", visit }, { status: 200 });
  }

  const now = new Date();
  const todayKey = riyadhDayKey(now);

  // Must belong to TODAY's open shift. Comparing against the shift id subsumes
  // the same-day check, because there is exactly one shift per employee per day.
  const todayShift: any = await Shift.findOne({
    userId: userPayload._id,
    dayKey: todayKey,
    status: shiftStatus.IN_PROGRESS,
  });
  if (!todayShift) {
    return NextResponse.json(
      { status: 409, reason: "NO_OPEN_SHIFT", message: "ابدأ الدوام أولاً قبل متابعة الزيارة." },
      { status: 409 },
    );
  }
  if (String(visit.shiftId) !== String(todayShift._id)) {
    return NextResponse.json(
      { status: 409, reason: "OTHER_DAY", message: "لا يمكن متابعة زيارة من يوم آخر." },
      { status: 409 },
    );
  }

  // One open visit at a time, or the dashboard has no single answer to
  // "which visit am I in".
  const otherOpen = await Visit.findOne({
    createdBy: userPayload._id,
    status: shiftStatus.IN_PROGRESS,
    isActive: true,
  });
  if (otherOpen) {
    return NextResponse.json(
      {
        status: 409,
        reason: "ANOTHER_OPEN",
        message: "لديك زيارة مفتوحة بالفعل.",
        visit: otherOpen,
      },
      { status: 409 },
    );
  }

  // Recency fuse. Without it, reopening a 09:00 visit at 18:00 records a
  // nine-hour visit and poisons the duration report; it is also what keeps a
  // legitimate hospital A → B → A day as three visits rather than two.
  const settings = await getSettings();
  const cutoffMs = now.getTime() - settings.inactivityMinutes * 60000;
  if (!visit.endTime || new Date(visit.endTime).getTime() < cutoffMs) {
    return NextResponse.json(
      {
        status: 409,
        reason: "TOO_OLD",
        message: `انتهت هذه الزيارة منذ أكثر من ${settings.inactivityMinutes} دقيقة. ابدأ زيارة جديدة.`,
      },
      { status: 409 },
    );
  }

  // Classify this session against the hospital, exactly as visit/create does for
  // the first one. Without it every session after the first was unclassified and
  // therefore invisible to the compliance report — an employee could start in
  // range and resume from anywhere. Soft: never blocks.
  const hospital = visit.hospitalId
    ? await Hospital.findById(visit.hospitalId).select("location")
    : null;
  const fence = evaluateFence(startLocation, hospital?.location, settings.geofenceRadiusMeters);

  const segments = visit.segments ?? [];
  if (segments.length === 0) {
    // Legacy visit: reconstruct the original session before appending. The fence
    // pair must come across too — applyVisitRollups projects segments[0] back
    // onto the top level, so omitting it would erase the original verdict.
    segments.push({
      startTime: visit.startTime,
      endTime: visit.endTime,
      startLocation: visit.startLocation,
      endLocation: visit.endLocation,
      startFenceStatus: visit.startFenceStatus,
      startDistanceMeters: visit.startDistanceMeters,
    });
  }
  const segment = {
    startTime: now,
    startLocation,
    startFenceStatus: fence.status,
    startDistanceMeters: fence.distanceMeters ?? undefined,
  };
  segments.push(segment);
  visit.segments = segments;
  applyVisitRollups(visit);
  await visit.save();

  // Keep the shift out of the auto-close job's sights.
  await Shift.updateOne(
    { _id: todayShift._id, status: shiftStatus.IN_PROGRESS },
    { $set: { lastActivityAt: now } },
  ).catch(() => {});

  // `segment`, not `visit`: the visit's top-level fence fields describe the
  // ORIGINAL check-in, which on a resume is hours old — warning on those would
  // report the wrong session.
  return NextResponse.json({ message: "Visit resumed", visit, segment }, { status: 200 });
}
