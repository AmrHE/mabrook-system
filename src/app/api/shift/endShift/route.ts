import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Shift } from "@/models/Shift";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { cookies } from "next/headers";
import { User } from "@/models/User";

/** Only keep a coordinate pair when both values are finite numbers. */
function sanitizeLocation(loc: unknown): { lat: number; lng: number } | undefined {
  const l = loc as { lat?: unknown; lng?: unknown } | null | undefined;
  if (l && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))) {
    return { lat: Number(l.lat), lng: Number(l.lng) };
  }
  return undefined;
}

export async function POST(req: NextRequest) {

  await initDb();
  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }
  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }
  /***************AUTH GAURD END****************/

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const body = await req.json().catch(() => ({}));
  const endLocation = sanitizeLocation(body?.location);

  // Close ALL open shifts for this user (defends against legacy duplicates), newest-first.
  const open = await Shift.find({ userId: userPayload._id, status: shiftStatus.IN_PROGRESS }).sort({ startTime: -1 });

  if (open.length === 0) {
    return NextResponse.json({status: 404, message: "No shift is currently opened! please start a new shift"})
  }

  const now = new Date();
  const [current, ...stragglers] = open;

  // The one the employee is actually ending: end = now, MANUAL, with check-out location.
  current.status = shiftStatus.ENDED;
  current.endTime = now;
  current.endLocation = endLocation;
  current.autoClosed = false;
  current.closeReason = shiftCloseReason.MANUAL;
  await current.save();

  // Any extra open shifts are duplicates — end them at their last activity, flagged.
  for (const s of stragglers) {
    s.status = shiftStatus.ENDED;
    s.endTime = s.lastActivityAt ?? s.startTime;
    s.autoClosed = true;
    s.closeReason = shiftCloseReason.DUPLICATE;
    await s.save();
  }

  const user = await User.findById(userPayload._id);
  if (user) {
    user.isOnShift = false;
    await user.save();
  }

  const cookieStore = await cookies();
  cookieStore.set('shiftStatus', shiftStatus.ENDED);
  return NextResponse.json({ message: "Shift Ended", shift: current }, { status: 200 });
}
