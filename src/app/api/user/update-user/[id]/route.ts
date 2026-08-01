import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { User } from "@/models/User";
import { resolveProject } from "@/utils/project/projects.server";
// import bcrypt from "bcrypt";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;
  
  const reqBody = await req.json()
  const {
    firstName,
    lastName,
    phoneNumber,
    password,
    email,
    userRole,
    salary,
    iban,
    bankName,
    identityNumber,
    identityImage,
    assignedHospitals,
    project,
  } = reqBody;


  await initDb();
  /***************ADMIN GAURD START****************/
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

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
  if (password) user.passwordHash = password;
  // Use `!== undefined` so a 0 salary, an empty hospital list, or cleared text
  // fields are still written (a plain truthy check would skip them).
  if (salary !== undefined) user.salary = salary;
  if (iban !== undefined) user.iban = iban;
  if (bankName !== undefined) user.bankName = bankName;
  if (identityNumber !== undefined) user.identityNumber = identityNumber;
  if (identityImage !== undefined) user.identityImage = identityImage;
  if (assignedHospitals !== undefined) user.assignedHospitals = assignedHospitals;
  // Canonicalize against the valid set; ignore unknown/blank values so a bad
  // payload can't wipe an existing project.
  if (project !== undefined) {
    const resolved = await resolveProject(project);
    if (resolved) user.project = resolved;
  }
  //   {
  //   const hashedPassword = await bcrypt.hash(password, 10);
  //   user.passwordHash = hashedPassword;
  // }

  user.updatedAt = new Date();
  await user.save();

  return NextResponse.json({ message: "User updated successfully", user }, { status: 200 });
}
