import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Hospital } from "@/models/Hospital";
import { resolveCity, resolveDistrict } from "@/utils/geo/locations.server";

export const dynamic = "force-dynamic";

/**
 * POST /api/locations/cleanup            (admin only) — DRY RUN (reports only)
 * POST /api/locations/cleanup?apply=true (admin only) — writes canonical values
 *
 * One-time normalization of the existing free-text hospital city/district values
 * to their canonical spelling (folding جدة/جده, tashkeel, spacing, leading "حي").
 * Anything that can't be confidently matched is returned in `unmatched` for a
 * human to fix via the edit form (where they can also "add new" if legitimately
 * missing from the dataset).
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  const apply = req.nextUrl.searchParams.get("apply") === "true";

  try {
    const hospitals = await Hospital.find({}).select("name city district").lean();

    const changes: Array<{ id: string; name: string; from: { city?: string; district?: string }; to: { city?: string; district?: string } }> = [];
    const unmatchedCities = new Map<string, string[]>(); // rawCity -> hospital names
    const unmatchedDistricts = new Map<string, string[]>(); // "city ⟩ district" -> hospital names

    for (const h of hospitals as Array<{ _id: unknown; name?: string; city?: string; district?: string }>) {
      const rawCity = (h.city ?? "").trim();
      const rawDistrict = (h.district ?? "").trim();
      const hName = h.name ?? String(h._id);

      const canonCity = rawCity ? await resolveCity(rawCity) : null;
      // Resolve district against the canonical city when we have it, else the raw city.
      const cityForDistrict = canonCity ?? rawCity;
      const canonDistrict = rawDistrict ? await resolveDistrict(cityForDistrict, rawDistrict) : null;

      const to: { city?: string; district?: string } = {};
      if (rawCity && canonCity && canonCity !== rawCity) to.city = canonCity;
      if (rawDistrict && canonDistrict && canonDistrict !== rawDistrict) to.district = canonDistrict;

      if (rawCity && !canonCity) {
        unmatchedCities.set(rawCity, [...(unmatchedCities.get(rawCity) ?? []), hName]);
      }
      if (rawDistrict && !canonDistrict) {
        const key = `${rawCity || "?"} ⟩ ${rawDistrict}`;
        unmatchedDistricts.set(key, [...(unmatchedDistricts.get(key) ?? []), hName]);
      }

      if (Object.keys(to).length > 0) {
        changes.push({ id: String(h._id), name: hName, from: { city: rawCity, district: rawDistrict }, to });
        if (apply) {
          await Hospital.findByIdAndUpdate(h._id, { $set: to });
        }
      }
    }

    return NextResponse.json({
      dryRun: !apply,
      hospitalsScanned: hospitals.length,
      wouldUpdateOrUpdated: changes.length,
      changes,
      unmatchedCities: Object.fromEntries(unmatchedCities),
      unmatchedDistricts: Object.fromEntries(unmatchedDistricts),
      hint: apply
        ? "تم تطبيق التعديلات. راجع القيم غير المطابقة وصححها يدويًا."
        : "تشغيل تجريبي فقط. أعد الطلب مع ?apply=true لتطبيق التعديلات.",
    });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تنفيذ عملية التنظيف" }, { status: 500 });
  }
}
