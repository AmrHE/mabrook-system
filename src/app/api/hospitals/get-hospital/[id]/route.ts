import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { userRoles } from "@/models/enum.constants";
import { Hospital } from "@/models/Hospital";
import { User } from "@/models/User";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {

  const { id } = await params;

  
  await initDb();
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload) {
    return NextResponse.json({status: 400, message: "Cannot identify the user Please re-login and try again"})
  }

  // Admins and warehouse users can open any hospital; employees only their own
  // assignments. Checked before the findById so it costs less and doesn't leak
  // whether the id exists. (The old check compared against `createdBy`, which no
  // employee could ever satisfy — hospitals are created by admins.)
  if (userPayload.role === userRoles.EMPLOYEE) {
    const me = await User.findById(userPayload._id).select("assignedHospitals").lean();
    const assigned = ((me as { assignedHospitals?: unknown[] } | null)?.assignedHospitals || []).map((h) =>
      String(h),
    );
    if (!assigned.includes(id)) {
      return NextResponse.json(
        { status: 403, message: "This Action is not allowed for you" },
        { status: 403 },
      );
    }
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

  if(!hospital) {
    return NextResponse.json({status: 404, message: "No hospital found with the provided ID"})
  }

  // Employees assigned to this hospital (reverse of User.assignedHospitals).
  const assignedEmployees = await User
    .find({ assignedHospitals: id, isActive: true })
    .select('firstName lastName email')
    .lean();

  return NextResponse.json({ message: "Hospital fetched successfully", hospital, assignedEmployees }, { status: 200 });
}
