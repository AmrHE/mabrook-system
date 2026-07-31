import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { initDb } from "@/lib/mongoose";
import { AppAddition } from "@/models/AppAddition";
import { Mom } from "@/models/Mom";
import { foldArabic } from "@/utils/geo/foldArabic";

export const dynamic = "force-dynamic";

/**
 * POST /api/apps/delete  (admin only)
 * Body: { name: string }
 *
 * Removes an app from the list and pulls it from every mom's installedApp array
 * so no mom keeps a tag that's no longer in the list.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ status: 400, message: "اسم التطبيق مطلوب" }, { status: 400 });

  const key = foldArabic(name);

  try {
    await initDb();
    const additions = (await AppAddition.find({}).lean()) as unknown as { _id: unknown; name: string }[];
    const target = additions.find((a) => foldArabic(a.name) === key);
    if (!target) {
      return NextResponse.json({ status: 404, message: "التطبيق غير موجود" }, { status: 404 });
    }

    await AppAddition.deleteOne({ _id: target._id });
    const res = await Mom.updateMany({ installedApp: target.name }, { $pull: { installedApp: target.name } });

    return NextResponse.json(
      { message: "تم حذف التطبيق", name: target.name, affectedMoms: res.modifiedCount ?? 0 },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ status: 500, message: "فشل حذف التطبيق" }, { status: 500 });
  }
}
