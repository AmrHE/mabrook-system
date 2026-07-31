import { NextResponse } from "next/server";
import { getProjects } from "@/utils/project/projects.server";

// Reads admin-added deltas from Mongo, so never statically cache.
export const dynamic = "force-dynamic";

/** GET /api/projects → { projects: string[] } (base ∪ admin-added, sorted). */
export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحميل قائمة المشاريع", projects: [] }, { status: 500 });
  }
}
