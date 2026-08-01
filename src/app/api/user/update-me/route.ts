import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { User } from "@/models/User";

export async function PATCH(req: NextRequest) {

  const reqBody = await req.json()
  const { firstName, lastName, phoneNumber } = reqBody;

  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const user = await User.findById(userPayload._id)

  if(!user) {
    return NextResponse.json({status: 404, message: "No user found"})
  }

  // Update user fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phoneNumber) user.phoneNumber = phoneNumber;
  user.updatedAt = new Date();
  await user.save();

  return NextResponse.json({ message: "User fetched successfully", user }, { status: 200 });
}
