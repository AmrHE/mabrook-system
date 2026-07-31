/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/auth/requireAuth";
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus } from "@/models/enum.constants";

export const dynamic = "force-dynamic";

/**
 * Withdraw one's own request while it is still pending.
 *
 * Only the requester may cancel, and only before a decision — otherwise an
 * employee could undo an approval (and its payroll effect) after the fact.
 * Cancelled requests are ignored entirely by the leave ledger.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const { id } = await params;
    const leave = await LeaveRequest.findOne({ _id: id, isActive: true });

    if (!leave) {
      return NextResponse.json({ error: "Not found", message: "الطلب غير موجود" }, { status: 404 });
    }
    if (String(leave.userId) !== String(payload._id)) {
      return NextResponse.json(
        { error: "Forbidden", message: "لا يمكنك إلغاء طلب لا يخصك" },
        { status: 403 },
      );
    }
    if (leave.status !== leaveStatus.PENDING) {
      return NextResponse.json(
        { error: "Already decided", message: "لا يمكن إلغاء طلب تم اتخاذ قرار بشأنه" },
        { status: 409 },
      );
    }

    leave.status = leaveStatus.CANCELLED;
    await leave.save();

    return NextResponse.json({ message: "تم إلغاء الطلب", leave }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "حدث خطأ أثناء إلغاء الطلب" },
      { status: 500 },
    );
  }
}
