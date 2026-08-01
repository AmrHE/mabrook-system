import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { User } from "@/models/User";
import { getMomRateBaseline } from "@/utils/analytics/visitProductivity";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;


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

  const user = await User.findById(id)
  .populate({
    path: "visits",
    model: "Visit",
    select: "hospitalId moms status isActive createdAt startTime endTime startLocation endLocation notes notesUpdatedAt",
    populate: { path: "hospitalId", model: "Hospital", select: "name city district" },
  })
  .populate({path: "assignedHospitals", model: "Hospital", select: "name city district"})
  .lean()
  .sort({ createdAt: -1 });//remove this sort function and check this line all over the codebase

  if(!user) {
    return NextResponse.json({status: 404, message: "No user found"})
  }

  // Same team baseline the analytics use, so this employee's visits carry the
  // identical productivity verdict they get on /visits.
  const momRateBaseline = await getMomRateBaseline();

  return NextResponse.json({ message: "User fetched successfully", user, momRateBaseline }, { status: 200 });
}
