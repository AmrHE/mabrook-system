import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import { userRoles } from "@/models/enum.constants";
import { initDb } from "../../../../lib/mongoose";
import { User } from "@/models/User";



export async function POST(req: NextRequest) {

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

  const { firstName, lastName, email, password, phoneNumber, role } = await req.json();

  if (!firstName || !lastName || !email || !password || !phoneNumber || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    await initDb();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      firstName,
      lastName,
      email,
      hashedPassword: password,
      phoneNumber,
      role
    });

    return NextResponse.json({ message: "User created", user: newUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: err }, { status: 500 });
  }
}
