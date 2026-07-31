/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus, userRoles } from "@/models/enum.constants";

export const dynamic = "force-dynamic";

/**
 * How many requests are waiting on the caller.
 *
 * For an admin that's everyone's pending requests except their own — they can't
 * decide those, so counting them would be a badge they can never clear. For
 * everyone else it's their own requests still awaiting a decision.
 */
export async function GET(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const query: Record<string, unknown> =
      payload.role === userRoles.ADMIN
        ? { isActive: true, status: leaveStatus.PENDING, userId: { $ne: payload._id } }
        : { isActive: true, status: leaveStatus.PENDING, userId: payload._id };

    const count = await LeaveRequest.countDocuments(query);
    return NextResponse.json({ count }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "تعذّر تحميل عدد الطلبات" },
      { status: 500 },
    );
  }
}
