/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { leaveStatus } from "@/models/enum.constants";
import { decideLeaveRequest } from "@/utils/leave/decide";

export const dynamic = "force-dynamic";

/**
 * Reject a pending leave request. A note is required so the employee is told why.
 * A rejected request has no pay mode — it never costs anything, and the day falls
 * back to whatever the attendance data says (a no-show if they didn't come in).
 *
 * An admin can never reject their own request; see `decideLeaveRequest`.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const decisionNote = String(body.decisionNote ?? "").trim();

    if (!decisionNote) {
      return NextResponse.json(
        { error: "Missing decisionNote", message: "الرجاء كتابة سبب الرفض" },
        { status: 400 },
      );
    }

    const result = await decideLeaveRequest({
      id,
      adminId: payload._id,
      decision: leaveStatus.REJECTED,
      decisionNote,
    });
    if (result.error) return result.error;

    return NextResponse.json({ message: "تم رفض الطلب", leave: result.leave }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "حدث خطأ أثناء رفض الطلب" },
      { status: 500 },
    );
  }
}
