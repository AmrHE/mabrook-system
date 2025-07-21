import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { User } from "@/models/User";
import bcrypt from "bcrypt";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  
  const reqBody = await req.json()
  const { firstName, lastName, phoneNumber, password, email, userRole } = reqBody;


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

  const user = await User.findById(id)

  if(!user) {
    return NextResponse.json({status: 404, message: "No user found"})
  }

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phoneNumber) user.phoneNumber = phoneNumber;
  if (email) user.email = email;
  if (userRole) user.role = userRole;
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    user.passwordHash = hashedPassword;
  }

  user.updatedAt = new Date();
  await user.save();

  return NextResponse.json({ message: "User updated successfully", user }, { status: 200 });
}
