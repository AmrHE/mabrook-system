/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { leavePayMode, leaveStatus } from "@/models/enum.constants";
import { decideLeaveRequest } from "@/utils/leave/decide";

export const dynamic = "force-dynamic";

/**
 * Approve a pending leave request.
 *
 * `payMode` is required and is the admin's call, never the requester's — it is
 * what decides whether the time off costs the employee anything:
 *   PAID   → no deduction
 *   UNPAID → a full-day leave is deducted like a no-show; a permit costs a flat 1/4 day
 *
 * An admin can never approve their own request; see `decideLeaveRequest`.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const payMode = String(body.payMode ?? "");

    if (!Object.values(leavePayMode).includes(payMode as leavePayMode)) {
      return NextResponse.json(
        { error: "Invalid payMode", message: "يجب تحديد ما إذا كان الطلب مدفوعًا أو غير مدفوع" },
        { status: 400 },
      );
    }

    const result = await decideLeaveRequest({
      id,
      adminId: payload._id,
      decision: leaveStatus.APPROVED,
      payMode: payMode as leavePayMode,
      decisionNote: String(body.decisionNote ?? "").trim(),
    });
    if (result.error) return result.error;

    return NextResponse.json({ message: "تم اعتماد الطلب", leave: result.leave }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "حدث خطأ أثناء اعتماد الطلب" },
      { status: 500 },
    );
  }
}
