// app/api/logout/route.ts
import { initDb } from "@/lib/mongoose";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { Shift } from "@/models/Shift";
import { User } from "@/models/User";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  await initDb();

  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (userId) {
    // Close ALL open shifts for the user (not just one) on logout.
    await Shift.updateMany(
      { userId, status: shiftStatus.IN_PROGRESS },
      { $set: { status: shiftStatus.ENDED, endTime: new Date(), closeReason: shiftCloseReason.LOGOUT } },
    );

    const user = await User.findById(userId);
    if (user) {
      user.isOnShift = false;
      await user.save();
    }
  }

  cookieStore.delete("access_token");
  cookieStore.delete("role");
  cookieStore.delete("email");
  cookieStore.delete("userId");

  return NextResponse.json({ success: true });
}
