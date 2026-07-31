import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { initDb } from '../../../../lib/mongoose';
import { Visit } from '@/models/Visit';
import { User } from '@/models/User';
import { Shift } from '@/models/Shift';
import { Hospital } from '@/models/Hospital';
import { cookies } from 'next/headers';
import { shiftStatus } from '@/models/enum.constants';
import { getSettings } from '@/utils/settings/getSettings';
import { evaluateFence } from '@/utils/geo/geofence';

export async function POST(req: NextRequest) {
  /***************Auth GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(' ')[1];
  if (!userToken) {
    return NextResponse.json({
      status: 401,
      message: 'Session has timed out. Please log in to use Mabrook System',
    });
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string };

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: 'Cannot identify the user Please re-login and try again'});
  }
  /***************Auth GAURD END****************/

  const { hospitalId, shiftId, startLocation } = await req.json();
  if (!hospitalId || !shiftId || !startLocation) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }


  try {
    await initDb();

    // Classify the check-in against the chosen hospital's geofence (soft — never blocks).
    const [hospital, settings] = await Promise.all([
      Hospital.findById(hospitalId).select('location'),
      getSettings(),
    ]);
    const fence = evaluateFence(startLocation, hospital?.location, settings.geofenceRadiusMeters);

    const newVisit = await Visit.create({
      createdBy: userPayload._id,
      shiftId,
      hospitalId: hospitalId,
      startLocation: startLocation,
      startFenceStatus: fence.status,
      startDistanceMeters: fence.distanceMeters ?? undefined,
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

  const cookieStore = await cookies()
  cookieStore.set('visitStatus', shiftStatus.IN_PROGRESS)
  cookieStore.set('currentVisit', newVisit._id)

    return NextResponse.json({ message: 'Hospital added and visit started',visit: newVisit }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err },{ status: 500 });
  }
}
