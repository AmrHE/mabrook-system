import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Shift } from "@/models/Shift";
import { shiftStatus } from "@/models/enum.constants";

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

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const currentShift = await Shift.findOne({
    userId: userPayload._id,
    status: shiftStatus.IN_PROGRESS
  });

  if(!currentShift) {
    return NextResponse.json({status: 404, message: "No shift is currently opened! please start a new shift"})
  }

  return NextResponse.json({ message: "Shift Started", shift: currentShift }, { status: 200 });
}
 