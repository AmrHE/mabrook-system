import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
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

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const user = await User
  .findOne({ _id: userPayload._id })
  .sort({ createdAt: -1 });

  if(!user) {
    return NextResponse.json({status: 404, message: "No user found"})
  }

  return NextResponse.json({ message: "User fetched successfully", user }, { status: 200 });
}
