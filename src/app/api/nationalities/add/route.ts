import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { NationalityAddition } from "@/models/NationalityAddition";
import { resolveNationality } from "@/utils/nationality/nationalities.server";

export const dynamic = "force-dynamic";

/**
 * POST /api/nationalities/add  (admin only)
 * Body: { name: string }  — the canonical feminine spelling.
 *
 * Idempotent: if the value already resolves (dataset or a prior addition),
 * returns the existing canonical spelling instead of inserting a duplicate.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ status: 400, message: "الاسم مطلوب" }, { status: 400 });
  }

  try {
    const existing = await resolveNationality(name);
    if (existing) {
      return NextResponse.json({ message: "الجنسية موجودة بالفعل", name: existing, created: false }, { status: 200 });
    }
    await NationalityAddition.create({ name, createdBy: auth.payload._id });
    return NextResponse.json({ message: "تمت إضافة الجنسية", name, created: true }, { status: 201 });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل إضافة الجنسية" }, { status: 500 });
  }
}
