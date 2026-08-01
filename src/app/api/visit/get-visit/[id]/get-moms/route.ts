import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { Mom } from "@/models/Mom";
import { userRoles } from "@/models/enum.constants";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;

  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const moms = await Mom
  .find(userPayload.role === userRoles.ADMIN ? {visitId: id, isActive: true} : {visitId: id, createdBy: userPayload._id, isActive: true})
  .populate({path: 'visitId', populate: { path: 'hospitalId', model: 'Hospital'}})
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .sort({ createdAt: -1 })

  if(!moms) {
    return NextResponse.json({status: 404, message: "No moms found"})
  }

  return NextResponse.json({ message: "Moms fetched successfully", moms }, { status: 200 });
}
