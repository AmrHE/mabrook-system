/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { LeaveRequest } from "@/models/LeaveRequest";

export const dynamic = "force-dynamic";

/**
 * Soft-delete a leave request (admin only) — the escape hatch for a mistaken
 * approval, since a decision itself can't be reversed.
 *
 * Note this changes payroll: an approved PAID day that is deleted becomes an
 * absence again, and the leave ledger only reads `isActive: true`.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();

  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: { isActive: false, deletedAt: new Date() } },
      { new: true },
    );

    if (!leave) {
      return NextResponse.json({ error: "Not found", message: "الطلب غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ message: "تم حذف الطلب" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "حدث خطأ أثناء حذف الطلب" },
      { status: 500 },
    );
  }
}
