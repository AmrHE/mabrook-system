// app/api/logout/route.ts
import { shiftStatus } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { User } from "@/models/User";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  await Shift.findOneAndUpdate(
    {userId, status: shiftStatus.IN_PROGRESS}, 
    {status: shiftStatus.ENDED, endTime: Date.now()},
    {new: true}
  );

  const user = await User.findById(userId);
  user.isOnShift = false;
  await user.save();
  
  cookieStore.delete("access_token");
  cookieStore.delete("role");
  cookieStore.delete("email");
  cookieStore.delete("userId");

  return NextResponse.json({ success: true });
}
