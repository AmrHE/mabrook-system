import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { initDb } from "@/lib/mongoose";
import { ProjectAddition } from "@/models/ProjectAddition";
import { User } from "@/models/User";
import { PROJECT_BASE } from "@/utils/project/projects.server";
import { foldArabic } from "@/utils/geo/foldArabic";

export const dynamic = "force-dynamic";

const DEFAULT_PROJECT = "mabrook";

/**
 * POST /api/projects/delete  (admin only)
 * Body: { name: string }
 *
 * Removes an admin-added project. The seeded base ("mabrook") cannot be deleted.
 * Employees assigned to the deleted project are reassigned to the default so no
 * user is left with a project that's not in the list.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: 400, message: "اسم المشروع مطلوب" }, { status: 400 });

  const key = foldArabic(name);
  if (PROJECT_BASE.some((b) => foldArabic(b) === key)) {
    return NextResponse.json({ status: 400, message: "لا يمكن حذف المشروع الافتراضي" }, { status: 400 });
  }

  try {
    await initDb();
    const additions = (await ProjectAddition.find({}).lean()) as unknown as { _id: unknown; name: string }[];
    const target = additions.find((a) => foldArabic(a.name) === key);
    if (!target) {
      return NextResponse.json({ status: 404, message: "المشروع غير موجود" }, { status: 404 });
    }

    await ProjectAddition.deleteOne({ _id: target._id });
    const res = await User.updateMany({ project: target.name }, { $set: { project: DEFAULT_PROJECT } });

    return NextResponse.json(
      { message: "تم حذف المشروع", name: target.name, reassigned: res.modifiedCount ?? 0 },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ status: 500, message: "فشل حذف المشروع" }, { status: 500 });
  }
}
