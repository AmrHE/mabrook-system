import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Visit } from "@/models/Visit";
import { getMomRateBaseline } from "@/utils/analytics/visitProductivity";

export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;


  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const visits = await Visit
  .find(userPayload.role === userRoles.ADMIN ? {isActive: true} : {createdBy: userPayload._id, isActive: true} )
  .populate('hospitalId')
  .populate('shiftId')
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .populate({path: 'notesUpdatedBy', model: 'User', select: 'firstName lastName'})
  .sort({ createdAt: -1 });

  if(!visits) {
    return NextResponse.json({status: 404, message: "No visits found"})
  }

  // The productivity verdict is derived, never stored. Ship the team baseline
  // alongside the rows so the page can classify them with the same numbers the
  // admin analytics use — that shared scalar is what keeps the flag consistent
  // between this page and the data-quality drill-down.
  const momRateBaseline = await getMomRateBaseline();

  return NextResponse.json({ message: "Visits fetched successfully", visits, momRateBaseline }, { status: 200 });
}
