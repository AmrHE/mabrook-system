/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { LeaveRequest } from "@/models/LeaveRequest";
import { User } from "@/models/User";
import { leaveStatus, userRoles } from "@/models/enum.constants";

export const dynamic = "force-dynamic";

/**
 * List leave requests. Admins see everyone's; everyone else sees only their own
 * — the same role-scoping idiom as `api/mom/get-moms`.
 *
 * Also returns `adminCount`, so the UI can warn an admin that with fewer than two
 * admins nobody is able to decide their own requests (self-approval is forbidden).
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const isAdmin = payload.role === userRoles.ADMIN;
    const sp = req.nextUrl.searchParams;

    const query: Record<string, unknown> = { isActive: true };
    if (isAdmin) {
      const userId = sp.get("userId");
      if (userId) query.userId = userId;
    } else {
      // Non-admins are pinned to their own rows regardless of what they ask for.
      query.userId = payload._id;
    }

    const status = sp.get("status");
    if (status && Object.values(leaveStatus).includes(status as leaveStatus)) {
      query.status = status;
    }

    const [leaves, adminCount] = await Promise.all([
      LeaveRequest.find(query)
        .populate({ path: "userId", select: "firstName lastName email role project" })
        .populate({ path: "decidedBy", select: "firstName lastName email" })
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments({ role: userRoles.ADMIN, isActive: true }),
    ]);

    return NextResponse.json({ message: "Leave requests fetched successfully", leaves, adminCount }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "تعذّر تحميل الطلبات" },
      { status: 500 },
    );
  }
}
