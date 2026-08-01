import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Shift } from "@/models/Shift";
import { shiftStatus } from "@/models/enum.constants";

/**
 * @deprecated Use `GET /api/shift/current-state`, which also reports the
 * resumable shift, any stale open day, and the open/resumable visits. Kept for
 * one release in case an older client is still cached.
 */
export async function GET(req: NextRequest) {

  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

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
 