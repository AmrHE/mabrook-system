/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { LeaveRequest } from "@/models/LeaveRequest";
import { User } from "@/models/User";
import { userRoles } from "@/models/enum.constants";

export const dynamic = "force-dynamic";

/** One leave request. Visible to its requester and to any admin. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const { id } = await params;
    const leave = await LeaveRequest.findOne({ _id: id, isActive: true })
      .populate({ path: "userId", select: "firstName lastName email role project" })
      .populate({ path: "decidedBy", select: "firstName lastName email" })
      .lean<any>();

    if (!leave) {
      return NextResponse.json({ error: "Not found", message: "الطلب غير موجود" }, { status: 404 });
    }

    const isAdmin = payload.role === userRoles.ADMIN;
    const isOwner = String(leave.userId?._id ?? leave.userId) === String(payload._id);
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Forbidden", message: "لا تملك صلاحية الاطلاع على هذا الطلب" },
        { status: 403 },
      );
    }

    // Lets the detail page tell an admin why their own request has no decision
    // buttons: a second admin has to exist before anyone can approve it.
    const adminCount = await User.countDocuments({ role: userRoles.ADMIN, isActive: true });

    return NextResponse.json({ message: "Leave request fetched successfully", leave, adminCount }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "تعذّر تحميل الطلب" },
      { status: 500 },
    );
  }
}
