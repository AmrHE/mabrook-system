import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { initDb } from '../../../../lib/mongoose';
import { Mom } from '@/models/Mom';

export async function POST(req: NextRequest) {
  /***************Auth GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(' ')[1];
  if (!userToken) {
    return NextResponse.json({status: 401, message: 'Session has timed out. Please log in to use Mabrook System'});
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string };

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: 'Cannot identify the user Please re-login and try again'});
  }
  /***************Auth GAURD END****************/

  const { name, nationality, address, numberOfKids, numberOfnewborns, numberOfMales, numberOfFemales, genderOfNewborns, visitId } = await req.json();
  console.log({ name, nationality, address, numberOfKids, numberOfnewborns, numberOfMales, numberOfFemales, genderOfNewborns, visitId })
  if ( !name || !nationality || !address || !numberOfKids || !numberOfnewborns || !genderOfNewborns || !visitId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    await initDb();
    const newMom = await Mom.create({
      createdBy: userPayload._id,
      name,
      nationality,
      address,
      numberOfKids,
      numberOfnewborns,
      numberOfMales,
      numberOfFemales,
      genderOfNewborns,
      visitId,
    })

    if(!newMom) {
      return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
    }

    return NextResponse.json({ message: 'New Mom Added Successfully',mom: newMom,/* hospital: newHospital*/ }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err },{ status: 500 });
  }
}
