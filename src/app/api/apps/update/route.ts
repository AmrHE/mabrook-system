import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { initDb } from "@/lib/mongoose";
import { AppAddition } from "@/models/AppAddition";
import { Mom } from "@/models/Mom";
import { resolveApp } from "@/utils/app/apps.server";
import { foldArabic } from "@/utils/geo/foldArabic";

export const dynamic = "force-dynamic";

/**
 * POST /api/apps/update  (admin only)
 * Body: { oldName: string, newName: string }
 *
 * Renames an app and cascades the new spelling into every mom's installedApp
 * array. The new name must not collide with an existing app.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const oldName = typeof body?.oldName === "string" ? body.oldName.trim() : "";
  const newName = typeof body?.newName === "string" ? body.newName.trim() : "";
  if (!oldName || !newName) {
    return NextResponse.json({ status: 400, message: "الاسم القديم والجديد مطلوبان" }, { status: 400 });
  }

  const oldKey = foldArabic(oldName);
  const newKey = foldArabic(newName);

  try {
    // Reject a rename that would duplicate a different existing app.
    if (newKey !== oldKey) {
      const existing = await resolveApp(newName);
      if (existing) {
        return NextResponse.json({ status: 400, message: "اسم التطبيق مستخدم بالفعل" }, { status: 400 });
      }
    }

    await initDb();
    const additions = (await AppAddition.find({}).lean()) as unknown as { _id: unknown; name: string }[];
    const target = additions.find((a) => foldArabic(a.name) === oldKey);
    if (!target) {
      return NextResponse.json({ status: 404, message: "التطبيق غير موجود" }, { status: 404 });
    }

    await AppAddition.updateOne({ _id: target._id }, { $set: { name: newName } });
    const res = await Mom.updateMany(
      { installedApp: target.name },
      { $set: { "installedApp.$[el]": newName } },
      { arrayFilters: [{ el: target.name }] },
    );

    return NextResponse.json(
      { message: "تم تعديل التطبيق", name: newName, affectedMoms: res.modifiedCount ?? 0 },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تعديل التطبيق" }, { status: 500 });
  }
}
