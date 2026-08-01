import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from "@/utils/auth/requireAuth";
import { initDb } from '../../../../lib/mongoose';
import { Visit } from '@/models/Visit';
import { User } from '@/models/User';
import { Shift } from '@/models/Shift';
import { Hospital } from '@/models/Hospital';
import { shiftStatus } from '@/models/enum.constants';
import { getSettings } from '@/utils/settings/getSettings';
import { evaluateFence } from '@/utils/geo/geofence';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: 'Cannot identify the user Please re-login and try again'});
  }

  const { hospitalId, shiftId, startLocation } = await req.json();
  if (!hospitalId || !shiftId || !startLocation) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }


  try {
    await initDb();

    // The route had no idempotency guard, so a double tap (or a stale tab)
    // opened a second concurrent visit. Hand the caller the existing one back so
    // the UI can offer "متابعة الزيارة" instead of silently forking the record.
    const alreadyOpen = await Visit.findOne({
      createdBy: userPayload._id,
      status: shiftStatus.IN_PROGRESS,
      isActive: true,
    });
    if (alreadyOpen) {
      return NextResponse.json(
        {
          status: 409,
          message: 'لديك زيارة مفتوحة بالفعل. أنهِ الزيارة الحالية أو تابعها.',
          visit: alreadyOpen,
        },
        { status: 409 },
      );
    }

    // Classify the check-in against the chosen hospital's geofence (soft — never blocks).
    const [hospital, settings] = await Promise.all([
      Hospital.findById(hospitalId).select('location'),
      getSettings(),
    ]);
    const fence = evaluateFence(startLocation, hospital?.location, settings.geofenceRadiusMeters);

    const startTime = new Date();
    const newVisit = await Visit.create({
      createdBy: userPayload._id,
      shiftId,
      hospitalId: hospitalId,
      startTime,
      startLocation: startLocation,
      startFenceStatus: fence.status,
      startDistanceMeters: fence.distanceMeters ?? undefined,
      segments: [{ startTime, startLocation }],
      sessionsCount: 1,
      workedMinutes: 0,
    })

    if(!newVisit) {
      return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
    }

    const user = await User.findById(userPayload._id)
    user.visits.push(newVisit._id);
    await user.save();

    // Mark shift activity so the auto-close job doesn't treat this shift as idle.
    // Never let a bump failure fail the visit creation.
    try {
      const res = await Shift.updateOne(
        { _id: shiftId, status: shiftStatus.IN_PROGRESS },
        { $set: { lastActivityAt: new Date() } },
      );
      if (res.matchedCount === 0) {
        await Shift.updateOne(
          { userId: userPayload._id, status: shiftStatus.IN_PROGRESS },
          { $set: { lastActivityAt: new Date() } },
        );
      }
    } catch (e) {
      console.error('Failed to bump shift lastActivityAt (visit):', e);
    }

    return NextResponse.json({ message: 'Hospital added and visit started',visit: newVisit }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err },{ status: 500 });
  }
}
