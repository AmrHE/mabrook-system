import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { Hospital } from "@/models/Hospital";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;

  
  await initDb();
  /***************AUTH GAURD START****************/
  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];
  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
  }

  const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as { _id: string; email: string; role: string }
  /***************AUTH GAURD END****************/

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const hospital = await Hospital
  .findById(id)
  .populate({
    path: 'createdBy', 
    model: 'User', 
    select: 'email firstName lastName'
  })
  .populate({
    path: 'productStocks.product',
    model: 'Product',
    select: 'name size'
  });

  if(userPayload.role !== userRoles.ADMIN && userPayload._id !== hospital?.createdBy._id.toString()) {
    return NextResponse.json({status: 403, message: "You are not authorized to view this hospital"}, { status: 403 });
  }

  if(!hospital) {
    return NextResponse.json({status: 404, message: "No hospital found with the provided ID"})
  }

  return NextResponse.json({ message: "Hospital fetched successfully", hospital }, { status: 200 });
}
