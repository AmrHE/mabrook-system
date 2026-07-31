import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { initDb } from "@/lib/mongoose";
import { ProjectAddition } from "@/models/ProjectAddition";
import { User } from "@/models/User";
import { PROJECT_BASE, resolveProject } from "@/utils/project/projects.server";
import { foldArabic } from "@/utils/geo/foldArabic";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/update  (admin only)
 * Body: { oldName: string, newName: string }
 *
 * Renames an admin-added project and cascades the new spelling to every employee
 * assigned to it. The seeded base ("mabrook") cannot be renamed, and the new
 * name must not collide with an existing project.
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
  if (PROJECT_BASE.some((b) => foldArabic(b) === oldKey)) {
    return NextResponse.json({ status: 400, message: "لا يمكن تعديل المشروع الافتراضي" }, { status: 400 });
  }

  try {
    // Reject a rename that would duplicate a different existing project.
    if (newKey !== oldKey) {
      const existing = await resolveProject(newName);
      if (existing) {
        return NextResponse.json({ status: 400, message: "اسم المشروع مستخدم بالفعل" }, { status: 400 });
      }
    }

    await initDb();
    const additions = (await ProjectAddition.find({}).lean()) as unknown as { _id: unknown; name: string }[];
    const target = additions.find((a) => foldArabic(a.name) === oldKey);
    if (!target) {
      return NextResponse.json({ status: 404, message: "المشروع غير موجود" }, { status: 404 });
    }

    await ProjectAddition.updateOne({ _id: target._id }, { $set: { name: newName } });
    const res = await User.updateMany({ project: target.name }, { $set: { project: newName } });

    return NextResponse.json(
      { message: "تم تعديل المشروع", name: newName, updated: res.modifiedCount ?? 0 },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تعديل المشروع" }, { status: 500 });
  }
}
