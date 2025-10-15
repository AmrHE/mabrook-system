import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Visit } from "@/models/Visit";
// import bcrypt from "bcrypt";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  

  await initDb();
  /***************ADMIN GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }

  if (userPayload.role !== userRoles.ADMIN){
    return NextResponse.json({status: 403, message: "This Action is only allowed for Admins"})
  }
  /***************ADMIN GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const visit = await Visit.findById(id)

  if(!visit) {
    return NextResponse.json({status: 404, message: "No visit found"})
  }

  visit.isActive = false;

  visit.deletedAt = new Date();
  await visit.save();

  return NextResponse.json({ message: "Visit updated successfully", visit }, { status: 200 });
}
