import { NextRequest, NextResponse } from "next/server";
import { getDistricts } from "@/utils/geo/locations.server";

// Reads admin-added deltas from Mongo, so never statically cache.
export const dynamic = "force-dynamic";

/** GET /api/locations/districts?city=<name> → { districts: string[] }. */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  if (!city) {
    return NextResponse.json({ districts: [] });
  }
  try {
    const districts = await getDistricts(city);
    return NextResponse.json({ districts });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحميل قائمة الأحياء", districts: [] }, { status: 500 });
  }
}
