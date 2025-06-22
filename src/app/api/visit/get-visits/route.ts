import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { User } from "@/models/User";
import { Visit } from "@/models/Visit";

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


  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const user = await User.findById(userPayload._id)


  const visits = await Visit
  .find(userPayload.role === userRoles.ADMIN ? {} : {createdBy: user._id} )
  .populate('hospitalId')
  .populate('shiftId')
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .sort({ createdAt: -1 });

  if(!visits) {
    return NextResponse.json({status: 404, message: "No visits found"})
  }

  return NextResponse.json({ message: "Visits fetched successfully", visits }, { status: 200 });
}
