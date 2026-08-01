import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
// import { userRoles } from "@/models/enum.constants";
import { Visit } from "@/models/Visit";
import { getMomRateBaseline } from "@/utils/analytics/visitProductivity";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;

  
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const visit = await Visit
  .findById(id)
  .populate('hospitalId')
  .populate('shiftId')
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .populate({path: 'notesUpdatedBy', model: 'User', select: 'firstName lastName'})


  // if(userPayload.role !== userRoles.ADMIN && userPayload._id !== visit?.createdBy._id.toString()) {
  //   return NextResponse.json({status: 403, message: "You are not authorized to view this visit"}, { status: 403 });
  // }

  if(!visit) {
    return NextResponse.json({status: 404, message: "No visit found with the provided ID"})
  }

  // Derived at read time, never stored — see utils/analytics/visitProductivity.
  const momRateBaseline = await getMomRateBaseline();

  return NextResponse.json({ message: "Visit fetched successfully", visit, momRateBaseline }, { status: 200 });
}
