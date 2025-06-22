import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { initDb } from '../../../../lib/mongoose';
import { Hospital } from '@/models/Hospital';
import { Visit } from '@/models/Visit';

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

  const { name, district, city, shiftId, location } = await req.json();
console.log({ name, district, city, shiftId, location })
  if (!name || !district || !city || !shiftId || !location) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    await initDb();
    const existingHostpital = await Hospital.findOne({ name });
    if (existingHostpital) {
      return NextResponse.json({ error: 'Hostpital already exists' }, { status: 409 });
    }

    const newHospital = await Hospital.create({
      name,
      district,
      city,
      shiftId,
      createdBy: userPayload._id,
      location: location
    });

    if(!newHospital) {
      return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
    }
    const newVisit = await Visit.create({
      createdBy: userPayload._id,
      shiftId,
      hospitalId: newHospital._id,
      location,
    })

    if(!newVisit) {
      return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
    }

    newHospital.visitId = newVisit._id
    await newHospital.save()

    return NextResponse.json({ message: 'Hospital added and visit started',visit: newVisit, hospital: newHospital }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err },{ status: 500 });
  }
}
