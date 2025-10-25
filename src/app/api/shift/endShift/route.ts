import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Shift } from "@/models/Shift";
import { shiftStatus } from "@/models/enum.constants";
import { cookies } from "next/headers";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  
  await initDb();
  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }
  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }
  /***************AUTH GAURD END****************/

  if (!userPayload.email) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const endedShift = await Shift.findOneAndUpdate(
    {userId: userPayload._id, status: shiftStatus.IN_PROGRESS}, 
    {status: shiftStatus.ENDED, endTime: Date.now()},
    {new: true}
  );

    if(!endedShift) {
    return NextResponse.json({status: 404, message: "No shift is currently opened! please start a new shift"})
  }
const user = await User.findById(userPayload._id)
  user.isOnShift = false;
  await user.save();
  await endedShift.save()
  const cookieStore = await cookies()
  cookieStore.set('shiftStatus', shiftStatus.ENDED)
  return NextResponse.json({ message: "Shift Started", shift: endedShift }, { status: 200 });
}
