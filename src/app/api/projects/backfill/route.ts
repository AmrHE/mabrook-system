import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { initDb } from "@/lib/mongoose";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/backfill  (admin only)
 *
 * One-off post-deploy step: stamps project: "mabrook" on every user that predates
 * the field (missing / null / empty). Mongoose defaults only apply on insert, so
 * legacy documents need this to carry the value explicitly. Safe to re-run — it
 * only touches documents where project is absent or blank.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    await initDb();
    const res = await User.updateMany(
      { $or: [{ project: { $exists: false } }, { project: null }, { project: "" }] },
      { $set: { project: "mabrook" } },
    );
    return NextResponse.json(
      { message: "تم تحديث المشاريع", modified: res.modifiedCount ?? 0 },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ status: 500, message: "فشل تحديث المشاريع" }, { status: 500 });
  }
}
