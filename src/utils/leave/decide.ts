/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus, leavePayMode } from "@/models/enum.constants";

/**
 * Apply an admin's decision to a pending leave request.
 *
 * Shared by `approve/[id]` and `reject/[id]` so the two guards can never diverge:
 *
 *  1. Nobody decides their own request — not even an admin. This is the hard rule
 *     the business asked for, and it has no single-admin escape hatch: if an org
 *     has only one admin, that admin's own requests simply cannot be approved
 *     until a second admin exists (the /leaves page warns about this).
 *  2. Only a PENDING request can be decided, so a decision can't be silently
 *     overwritten by a second admin acting on a stale page.
 *
 * The caller has already passed `requireAdmin`, so `adminId` is a verified admin.
 */
export async function decideLeaveRequest({
  id,
  adminId,
  decision,
  payMode,
  decisionNote,
}: {
  id: string;
  adminId: string;
  decision: leaveStatus.APPROVED | leaveStatus.REJECTED;
  payMode?: leavePayMode;
  decisionNote?: string;
}): Promise<{ leave: any; error?: undefined } | { leave?: undefined; error: NextResponse }> {
  const leave = await LeaveRequest.findOne({ _id: id, isActive: true });
  if (!leave) {
    return {
      error: NextResponse.json(
        { error: "Leave request not found", message: "الطلب غير موجود" },
        { status: 404 },
      ),
    };
  }

  if (String(leave.userId) === String(adminId)) {
    return {
      error: NextResponse.json(
        {
          error: "Self-approval is not allowed",
          message: "لا يمكنك اعتماد أو رفض طلبك الخاص — يجب أن يقوم مدير آخر بمراجعته",
        },
        { status: 403 },
      ),
    };
  }

  if (leave.status !== leaveStatus.PENDING) {
    return {
      error: NextResponse.json(
        { error: "Request already decided", message: "تم اتخاذ قرار بشأن هذا الطلب مسبقًا" },
        { status: 409 },
      ),
    };
  }

  leave.status = decision;
  leave.decidedBy = adminId;
  leave.decidedAt = new Date();
  leave.decisionNote = decisionNote ?? "";
  // Pay mode is meaningful only on an approval; a rejected request never costs anything.
  leave.payMode = decision === leaveStatus.APPROVED ? payMode : undefined;
  await leave.save();

  return { leave };
}
