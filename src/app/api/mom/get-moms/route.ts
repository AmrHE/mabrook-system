import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Mom } from "@/models/Mom";
import { userRoles } from "@/models/enum.constants";

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

  const moms = await Mom
  .find(userPayload.role === userRoles.ADMIN ? {isActive: true} : {createdBy: userPayload._id, isActive: true})
  .populate({path: 'visitId', populate: { path: 'hospitalId', model: 'Hospital'}})
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .sort({ createdAt: -1 });

  if(!moms) {
    return NextResponse.json({status: 404, message: "No moms found"})
  }

  return NextResponse.json({ message: "Moms fetched successfully", moms }, { status: 200 });
}