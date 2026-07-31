import { NextResponse } from "next/server";
import { getApps } from "@/utils/app/apps.server";

// Reads admin-added apps from Mongo, so never statically cache.
export const dynamic = "force-dynamic";

/** GET /api/apps → { apps: string[] } (admin-added, sorted). */
export async function GET() {
  try {
    const apps = await getApps();
    return NextResponse.json({ apps });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحميل قائمة التطبيقات", apps: [] }, { status: 500 });
  }
}
