import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcrypt";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { initDb } from "../../../../lib/mongoose";
import { User } from "@/models/User";
import { resolveProject } from "@/utils/project/projects.server";



export async function POST(req: NextRequest) {

  /***************ADMIN GAURD START****************/
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (userPayload.role !== userRoles.ADMIN){
    return NextResponse.json({status: 403, message: "This Action is only allowed for Admins"})
  }
  /***************ADMIN GAURD END****************/

  const {
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    role,
    salary,
    iban,
    bankName,
    identityNumber,
    identityImage,
    assignedHospitals,
    project,
  } = await req.json();

  if (!firstName || !lastName || !email || !password || !phoneNumber || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    await initDb();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Canonicalize against the valid set (base ∪ admin additions); unknown/blank
    // values fall back to the default project.
    const resolvedProject = (await resolveProject(project)) ?? "mabrook";

    // const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      firstName,
      lastName,
      email,
      passwordHash: password,
      phoneNumber,
      role,
      salary,
      iban,
      bankName,
      identityNumber,
      identityImage,
      assignedHospitals: assignedHospitals ?? [],
      project: resolvedProject,
    });

    return NextResponse.json({ message: "User created", user: newUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: err }, { status: 500 });
  }
}
