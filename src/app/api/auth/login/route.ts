import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { initDb } from "../../../../lib/mongoose";
import { User } from "@/models/User";
import { createUserToken } from "@/utils/catchErrors";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  await initDb();
  const reqBody = await req.json()
  
  const {email, password} = reqBody;
  if (!email || !password) {
    return NextResponse.json({status: 400, message: "a required field is missing"})
  }

  const user = await User.findOne({email});

  if (user === null) {
    return NextResponse.json({status: 404, message: "this email cannot be found"})
    
  }

  const isMatching = await bcrypt.compare(password, user.passwordHash as string);

  if (!isMatching){
    return NextResponse.json({status: 401, message: "incorrect password"})
  }

  user.lastLogin = new Date();

  await user.save()

  console.log({user})

  user.password = ''; // not to return this field to the frontend

  const {userToken, tokenExpiration} = createUserToken(user.toObject() as unknown)
  const cookieStore = await cookies()
  cookieStore.set('access_token', userToken)
  cookieStore.set('role', user.role)
  cookieStore.set('email', user.email)
  cookieStore.set('userId', user._id)

  return NextResponse.json({user, userToken, tokenExpiration, status: 200});
}