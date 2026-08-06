import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Hospital } from "@/models/Hospital";
import { resolveCity, resolveDistrict } from "@/utils/geo/locations.server";
import { recomputeHospitalFences, type ReclassifyResult } from "@/utils/geo/reclassifyFence";
import { getSettings } from "@/utils/settings/getSettings";

/** Only keep a coordinate pair when both values are finite numbers. */
function sanitizeLocation(loc: unknown): { lat: number; lng: number } | undefined {
  const l = loc as { lat?: unknown; lng?: unknown } | null | undefined;
  if (l && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))) {
    return { lat: Number(l.lat), lng: Number(l.lng) };
  }
  return undefined;
}

/**
 * Admin-only edit of a hospital's core fields — primarily its geofence
 * `location`, which has no create/edit UI historically. name/city/district are
 * accepted too so the same route can back the detail-page edit form.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const set: Record<string, unknown> = {};

  if (body.location !== undefined) {
    const loc = sanitizeLocation(body.location);
    if (!loc) {
      return NextResponse.json({ status: 400, message: "إحداثيات الموقع غير صحيحة" }, { status: 400 });
    }
    set.location = loc;
  }

  if (body.name !== undefined) {
    const value = String(body.name).trim();
    if (!value) {
      return NextResponse.json({ status: 400, message: "اسم المستشفى لا يمكن أن يكون فارغًا" }, { status: 400 });
    }
    set.name = value;
  }

  // Manager contact details are all optional, so an empty string is a valid
  // value here — it clears a field the admin no longer wants filled.
  if (body.managerName !== undefined) {
    set.managerName = String(body.managerName).trim();
  }

  if (body.managerPhone !== undefined) {
    set.managerPhone = String(body.managerPhone).trim();
  }

  if (body.managerEmail !== undefined) {
    const value = String(body.managerEmail).trim();
    if (value && !/^\S+@\S+\.\S+$/.test(value)) {
      return NextResponse.json({ status: 400, message: "البريد الإلكتروني لمدير المستشفى غير صحيح" }, { status: 400 });
    }
    set.managerEmail = value;
  }

  // City/district must be canonical (from the approved list). District validity
  // depends on the city, so resolve the effective city first — the one in the
  // request if provided, otherwise the hospital's current city.
  const cityProvided = body.city !== undefined;
  const districtProvided = body.district !== undefined;
  if (cityProvided || districtProvided) {
    let effectiveCity: string | null = null;

    if (cityProvided) {
      effectiveCity = await resolveCity(String(body.city).trim());
      if (!effectiveCity) {
        return NextResponse.json({ status: 400, message: "المدينة غير موجودة في القائمة المعتمدة" }, { status: 400 });
      }
      set.city = effectiveCity;
    } else {
      const existing = (await Hospital.findById(id).select("city").lean()) as { city?: string } | null;
      effectiveCity = existing?.city ?? null;
    }

    if (districtProvided) {
      const canonicalDistrict = await resolveDistrict(effectiveCity, String(body.district).trim());
      if (!canonicalDistrict) {
        return NextResponse.json({ status: 400, message: "الحي غير موجود في القائمة المعتمدة لهذه المدينة" }, { status: 400 });
      }
      set.district = canonicalDistrict;
    }
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ status: 400, message: "لا توجد بيانات للتحديث" }, { status: 400 });
  }

  try {
    // Captured BEFORE the write: moving the pin invalidates every distance
    // measured against the old coordinates, and we can only tell it moved by
    // comparing against what was there.
    const before = set.location
      ? ((await Hospital.findById(id).select("location").lean()) as { location?: { lat?: number; lng?: number } } | null)
      : null;

    const updated = await Hospital.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true });
    if (!updated) {
      return NextResponse.json({ status: 404, message: "لم يتم العثور على المستشفى" }, { status: 404 });
    }

    // Past check-ins store a distance to this hospital and a verdict derived
    // from it. Both are wrong the moment the hospital moves, and no radius-based
    // recompute can fix them — the distance itself has to be re-measured from
    // the device fix that was recorded at check-in. Setting coordinates for the
    // first time also converts HOSPITAL_NOT_CONFIGURED records into real verdicts.
    let reclassified: ReclassifyResult | undefined;
    const next = set.location as { lat: number; lng: number } | undefined;
    if (next && (before?.location?.lat !== next.lat || before?.location?.lng !== next.lng)) {
      const settings = await getSettings();
      reclassified = await recomputeHospitalFences(id, next, settings.geofenceRadiusMeters);
    }

    return NextResponse.json({ message: "تم تحديث المستشفى بنجاح", hospital: updated, reclassified }, { status: 200 });
  } catch (err) {
    // Duplicate name (unique index) or validation failure.
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ status: 409, message: "يوجد مستشفى بنفس الاسم" }, { status: 409 });
    }
    return NextResponse.json({ status: 500, message: "فشل تحديث المستشفى" }, { status: 500 });
  }
}
