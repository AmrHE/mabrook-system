import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { User } from "@/models/User";
import { Hospital } from "@/models/Hospital";

export const dynamic = "force-dynamic";

/**
 * Admin: set the full list of employees assigned to a hospital. Assignment lives
 * on `User.assignedHospitals`, so this syncs both directions — adds the hospital
 * to every selected employee and removes it from everyone no longer selected.
 * Idempotent; sending an empty list clears all assignments for the hospital.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ status: 400, message: "معرّف المستشفى غير صحيح" }, { status: 400 });
  }

  const hospital = await Hospital.findById(id).select("_id");
  if (!hospital) {
    return NextResponse.json({ status: 404, message: "لم يتم العثور على المستشفى" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.employeeIds)
    ? body.employeeIds.filter((x: unknown) => typeof x === "string" && mongoose.isValidObjectId(x))
    : [];

  try {
    // Add this hospital to every selected employee (no duplicates).
    if (ids.length > 0) {
      await User.updateMany({ _id: { $in: ids } }, { $addToSet: { assignedHospitals: id } });
    }
    // Remove it from anyone previously assigned but not in the new selection.
    await User.updateMany(
      { _id: { $nin: ids }, assignedHospitals: id },
      { $pull: { assignedHospitals: id } },
    );

    return NextResponse.json({ message: "تم تحديث الموظفين المعينين", assignedCount: ids.length }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحديث الموظفين المعينين" }, { status: 500 });
  }
}
