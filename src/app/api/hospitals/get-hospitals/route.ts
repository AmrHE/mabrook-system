import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Hospital } from "@/models/Hospital";

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

  const hospitals = await Hospital
  .find(userPayload.role === userRoles.ADMIN ? {} : {createdBy: userPayload._id} )
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .sort({ createdAt: -1 });

  if(!hospitals) {
    return NextResponse.json({status: 404, message: "No hospitals found"})
  }

  return NextResponse.json({ message: "Hospitals fetched successfully", hospitals }, { status: 200 });
}
