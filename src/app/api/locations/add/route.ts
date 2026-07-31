import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { LocationAddition } from "@/models/LocationAddition";
import { resolveCity, resolveDistrict } from "@/utils/geo/locations.server";

export const dynamic = "force-dynamic";

/**
 * POST /api/locations/add  (admin only)
 * Body: { kind: "city" | "district", name: string, city?: string }
 *
 * Adds a canonical city/district that isn't in the bundled dataset. Idempotent:
 * if the value already resolves (dataset or a prior addition), returns the
 * existing canonical spelling instead of inserting a duplicate.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const city = typeof body?.city === "string" ? body.city.trim() : "";

  if (kind !== "city" && kind !== "district") {
    return NextResponse.json({ status: 400, message: "نوع غير صالح" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ status: 400, message: "الاسم مطلوب" }, { status: 400 });
  }
  if (kind === "district" && !city) {
    return NextResponse.json({ status: 400, message: "يجب تحديد المدينة للحي" }, { status: 400 });
  }

  try {
    if (kind === "city") {
      const existing = await resolveCity(name);
      if (existing) {
        return NextResponse.json({ message: "المدينة موجودة بالفعل", name: existing, created: false }, { status: 200 });
      }
      await LocationAddition.create({ kind: "city", name, createdBy: auth.payload._id });
      return NextResponse.json({ message: "تمت إضافة المدينة", name, created: true }, { status: 201 });
    }

    // kind === "district": the parent city must itself be a known city.
    const canonicalCity = await resolveCity(city);
    if (!canonicalCity) {
      return NextResponse.json({ status: 400, message: "المدينة غير معروفة" }, { status: 400 });
    }
    const existing = await resolveDistrict(canonicalCity, name);
    if (existing) {
      return NextResponse.json({ message: "الحي موجود بالفعل", name: existing, city: canonicalCity, created: false }, { status: 200 });
    }
    await LocationAddition.create({ kind: "district", name, city: canonicalCity, createdBy: auth.payload._id });
    return NextResponse.json({ message: "تمت إضافة الحي", name, city: canonicalCity, created: true }, { status: 201 });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل إضافة الموقع" }, { status: 500 });
  }
}
