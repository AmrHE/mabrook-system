import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  await initDb();
  /***************ADMIN GAURD START****************/
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (userPayload.role !== userRoles.ADMIN){
    return NextResponse.json({status: 403, message: "This Action is only allowed for Admins"})
  }
  /***************ADMIN GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const users = await User
  .find({isActive: true})
  .populate({path: "visits", model: "Visit", select: "isActive"})
  .sort({ createdAt: -1 });

  if(!users) {
    return NextResponse.json({status: 404, message: "No users found"})
  }

  return NextResponse.json({ message: "Users fetched successfully", users }, { status: 200 });
}
