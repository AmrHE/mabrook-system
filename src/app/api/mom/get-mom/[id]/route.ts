import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Mom } from "@/models/Mom";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {
  const { id } = await params;

  
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const mom = await Mom
  .findById(id)
  .populate({path: 'visitId', populate: { path: 'hospitalId', model: 'Hospital'}})
  .populate({path: 'createdBy', model: 'User', select: 'email firstName lastName'})
  .populate({path: 'survey.product', model: 'Product', select: 'name questions'})

  if(userPayload.role !== userRoles.ADMIN && userPayload._id !== mom?.createdBy._id.toString()) {
    return NextResponse.json({status: 403, message: "You are not authorized to view this mom"}, { status: 403 });
  }

  if(!mom) {
    return NextResponse.json({status: 404, message: "No mom found with the provided ID"})
  }

  return NextResponse.json({ message: "Mom fetched successfully", mom }, { status: 200 });
}
