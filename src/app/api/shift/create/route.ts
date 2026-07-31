import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Shift } from "@/models/Shift";
import { cookies } from "next/headers";
import { shiftStatus } from "@/models/enum.constants";
import { User } from "@/models/User";
import { Hospital } from "@/models/Hospital";
import { getSettings } from "@/utils/settings/getSettings";
import { evaluateFence, type FenceResult, type LatLng } from "@/utils/geo/geofence";

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

export async function POST(req: NextRequest) {

    await initDb();

  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }
  /***************AUTH GAURD END****************/


  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  // Body is optional (older clients send none) — tolerate a missing/empty body.
  const body = await req.json().catch(() => ({}));
  const startLocation = sanitizeLocation(body?.location);
  const hospitalId = typeof body?.hospitalId === "string" ? body.hospitalId : undefined;

  const cookieStore = await cookies();
  const user = await User.findById(userPayload._id);
  if (!user) {
    return NextResponse.json({ status: 404, message: "User not found" });
  }

  // Idempotent: if the employee already has an open shift, return it instead of
  // creating a duplicate (a primary cause of the "many open shifts" pile-up).
  const existing = await Shift.findOne({ userId: userPayload._id, status: shiftStatus.IN_PROGRESS });
  if (existing) {
    if (!user.isOnShift) {
      user.isOnShift = true;
      await user.save();
    }
    // Backfill check-in details on the already-open shift if they're missing.
    let changed = false;
    if (startLocation && !existing.startLocation?.lat) {
      existing.startLocation = startLocation;
      changed = true;
    }
    if (hospitalId && !existing.hospitalId) {
      existing.hospitalId = hospitalId;
      changed = true;
    }
    const effectiveHospitalId = existing.hospitalId ? String(existing.hospitalId) : hospitalId;
    if (!existing.startFenceStatus && effectiveHospitalId) {
      const fence = await computeFence(existing.startLocation, effectiveHospitalId);
      if (fence) {
        existing.startFenceStatus = fence.status;
        existing.startDistanceMeters = fence.distanceMeters ?? undefined;
        changed = true;
      }
    }
    if (changed) await existing.save();
    cookieStore.set('shiftStatus', shiftStatus.IN_PROGRESS);
    return NextResponse.json({ message: "Shift already in progress", shift: existing }, { status: 200 });
  }

  const fence = await computeFence(startLocation, hospitalId);
  const startTime = new Date();
  let newShift;
  try {
    newShift = await Shift.create({
      userId: userPayload._id,
      startTime,
      status: shiftStatus.IN_PROGRESS,
      lastActivityAt: startTime,
      startLocation,
      hospitalId: hospitalId || undefined,
      startFenceStatus: fence?.status,
      startDistanceMeters: fence?.distanceMeters ?? undefined,
    });
  } catch (err) {
    // 11000 = duplicate key from the partial-unique index (a concurrent start won the race).
    if ((err as { code?: number })?.code === 11000) {
      const raced = await Shift.findOne({ userId: userPayload._id, status: shiftStatus.IN_PROGRESS });
      cookieStore.set('shiftStatus', shiftStatus.IN_PROGRESS);
      return NextResponse.json({ message: "Shift already in progress", shift: raced }, { status: 200 });
    }
    throw err;
  }

  user.shifts.push(newShift._id);
  user.isOnShift = true;
  await user.save();

  cookieStore.set('shiftStatus', shiftStatus.IN_PROGRESS)

  return NextResponse.json({ message: "Shift Started", shift: newShift }, { status: 201 });
}
