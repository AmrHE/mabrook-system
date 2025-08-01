import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Shift } from "@/models/Shift";
import { cookies } from "next/headers";
import { shiftStatus } from "@/models/enum.constants";
import { User } from "@/models/User";


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

  const newShift = await Shift.create({
    userId: userPayload._id
  })

  const user = await User.findById(userPayload._id)
  user.shifts.push(newShift._id);
  await user.save();

  const cookieStore = await cookies()
  cookieStore.set('shiftStatus', shiftStatus.IN_PROGRESS)

  return NextResponse.json({ message: "Shift Started", shift: newShift }, { status: 201 });
}