import { NextResponse } from "next/server";
import { getCities } from "@/utils/geo/locations.server";

// Reads admin-added deltas from Mongo, so never statically cache.
export const dynamic = "force-dynamic";

/** GET /api/locations/cities → { cities: string[] } (canonical, Arabic-sorted). */
export async function GET() {
  try {
    const cities = await getCities();
    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحميل قائمة المدن", cities: [] }, { status: 500 });
  }
}
