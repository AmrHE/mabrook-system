import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Mom } from "@/models/Mom";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  
  const reqBody = await req.json()
  const { survey } = reqBody;

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

  const mom = await Mom.findById(id)

  if(!mom) {
    return NextResponse.json({status: 404, message: "No mom found"})
  }

  if (survey) mom.survey = survey;

  mom.updatedAt = new Date();
  await mom.save();

  return NextResponse.json({ message: "Mom updated successfully", mom }, { status: 200 });
}
