import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { initDb } from '../../../../lib/mongoose';
import { Hospital } from '@/models/Hospital';
import { userRoles } from '@/models/enum.constants';

export async function POST(req: NextRequest) {
  await initDb();

  /***************ADMIN GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(' ')[1];
  if (!userToken) {
    return NextResponse.json({
      status: 401,
      message: 'Session has timed out. Please log in to use Mabrook System',
    });
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string };

  
    if (userPayload.role !== userRoles.ADMIN){
      return NextResponse.json({status: 403, message: "This Action is only allowed for Admins"})
    }

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: 'Cannot identify the user Please re-login and try again'});
  }
  /***************ADMIN GAURD END****************/

  const { name, district, city } = await req.json();
  if (!name || !district || !city) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }


  const existingHostpital = await Hospital.findOne({ name });
  if (existingHostpital) {
    return NextResponse.json({ error: 'Hostpital already exists' }, { status: 409 });
  }

  const newHospital = await Hospital.create({
    name,
    district,
    city,
    createdBy: userPayload._id,
  });

  if(!newHospital) {
    return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
  }

  return NextResponse.json({ message: 'Hospital has been added successfully ', hospital: newHospital }, { status: 201 });
  
}
