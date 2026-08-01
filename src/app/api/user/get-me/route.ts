import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {



  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const user = await User
  .findOne({ _id: userPayload._id })
  .sort({ createdAt: -1 });

  if(!user) {
    return NextResponse.json({status: 404, message: "No user found"})
  }

  if(!user.isActive) {
    return NextResponse.json({status: 405, message: "User has been deleted"})
  }

  return NextResponse.json({ message: "User fetched successfully", user }, { status: 200 });
}
