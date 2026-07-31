import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { AppAddition } from "@/models/AppAddition";
import { resolveApp } from "@/utils/app/apps.server";

export const dynamic = "force-dynamic";

/**
 * POST /api/apps/add  (admin only)
 * Body: { name: string }  — the canonical display spelling.
 *
 * Idempotent: if the value already resolves, returns the existing canonical
 * spelling instead of inserting a duplicate.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ status: 400, message: "اسم التطبيق مطلوب" }, { status: 400 });
  }

  try {
    const existing = await resolveApp(name);
    if (existing) {
      return NextResponse.json({ message: "التطبيق موجود بالفعل", name: existing, created: false }, { status: 200 });
    }
    await AppAddition.create({ name, createdBy: auth.payload._id });
    return NextResponse.json({ message: "تمت إضافة التطبيق", name, created: true }, { status: 201 });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل إضافة التطبيق" }, { status: 500 });
  }
}
