import { NextResponse } from "next/server";
import { getNationalities } from "@/utils/nationality/nationalities.server";

// Reads admin-added deltas from Mongo, so never statically cache.
export const dynamic = "force-dynamic";

/** GET /api/nationalities → { nationalities: string[] } (canonical, Arabic-sorted). */
export async function GET() {
  try {
    const nationalities = await getNationalities();
    return NextResponse.json({ nationalities });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحميل قائمة الجنسيات", nationalities: [] }, { status: 500 });
  }
}
