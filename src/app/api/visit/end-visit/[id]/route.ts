import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { Visit } from "@/models/Visit";
import { shiftStatus } from "@/models/enum.constants";
import { cookies } from "next/headers";

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

  if (!userPayload.email) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  const endVisit = await Visit.findOneAndUpdate(
    {_id: id}, 
    {status: shiftStatus.ENDED, endTime: Date.now()},
    {new: true}
  );

    if(!endVisit) {
    return NextResponse.json({status: 404, message: "No Visit is currently opened! please start a new Visit"})
  }

  await endVisit.save()
  const cookieStore = await cookies()
  cookieStore.set('visitStatus', shiftStatus.ENDED)
  return NextResponse.json({ message: "Visit Ended", Visit: endVisit }, { status: 200 });
}
