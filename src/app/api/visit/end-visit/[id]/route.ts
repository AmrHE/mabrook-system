/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Visit } from "@/models/Visit";
import { shiftStatus, userRoles } from "@/models/enum.constants";
import { applyVisitRollups } from "@/utils/visit/rollup";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {
  const { id } = await params;

  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload.email) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  // End location is captured on the device when the employee ends the visit,
  // mirroring how a shift records its endLocation on check-out.
  const { endLocation } = await req.json();
  if (!endLocation) {
    return NextResponse.json({ status: 400, message: "Missing end location" }, { status: 400 });
  }

  const visit: any = await Visit.findById(id);
  if (!visit) {
    return NextResponse.json({ status: 404, message: "Visit not found" }, { status: 404 });
  }

  // The filter used to be `{_id: id}` alone, so any authenticated user could end
  // anyone else's visit just by knowing its id.
  const isOwner = String(visit.createdBy) === String(userPayload._id);
  if (!isOwner && userPayload.role !== userRoles.ADMIN) {
    return NextResponse.json(
      { status: 403, message: "لا يمكنك إنهاء زيارة يملكها موظف آخر" },
      { status: 403 },
    );
  }

  // Idempotent: re-ending used to rewrite endTime, inflating the recorded
  // duration every time the button was pressed twice.
  if (visit.status === shiftStatus.ENDED) {
    return NextResponse.json({ message: "Visit already ended", Visit: visit }, { status: 200 });
  }

  const now = new Date();
  const segments = visit.segments ?? [];
  const openIndex = segments.findIndex((s: any) => !s.endTime);
  if (openIndex >= 0) {
    segments[openIndex].endTime = now;
    segments[openIndex].endLocation = endLocation;
  } else {
    // Legacy visit with no segments — synthesise one from the original span so
    // the rollup has something authoritative to work from.
    segments.push({
      startTime: visit.startTime,
      endTime: now,
      startLocation: visit.startLocation,
      endLocation,
    });
    visit.segments = segments;
  }
  applyVisitRollups(visit);
  await visit.save();

  return NextResponse.json({ message: "Visit Ended", Visit: visit }, { status: 200 });
}
