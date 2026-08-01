import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { User } from "@/models/User";
import "@/models/Hospital"; // ensure the Hospital model is registered for populate

/**
 * Hospitals assigned to the authenticated employee, with the geofence `location`.
 * Feeds the shift-start and visit-start hospital pickers so an employee can only
 * check in against a hospital they're actually assigned to.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;
  if (!userPayload?._id) {
    return NextResponse.json({ status: 400, message: "Cannot identify the user Please re-login and try again" });
  }

  const user = await User.findById(userPayload._id).populate({
    path: "assignedHospitals",
    match: { isActive: true },
    select: "name location",
  });

  if (!user) {
    return NextResponse.json({ status: 404, message: "User not found" }, { status: 404 });
  }

  // populate drops non-matching (inactive/deleted) refs as null — filter them out.
  const hospitals = (user.assignedHospitals || []).filter(Boolean);

  return NextResponse.json({ message: "Assigned hospitals fetched", hospitals }, { status: 200 });
}
