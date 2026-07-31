/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { getDb, listBackupCollections } from "@/utils/backup/collections";

export const dynamic = "force-dynamic";

/**
 * Inventory of every collection in the database.
 *
 * Drives the progress indicator on the Settings backup card, and is written into
 * the downloaded zip as `manifest.json` so the document counts can be checked
 * against a restored database.
 */
export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const db = getDb();
    const names = await listBackupCollections();

    // Accurate counts, not estimatedDocumentCount() — these are the restore checksum.
    const collections = await Promise.all(
      names.map(async (name) => ({ name, count: await db.collection(name).countDocuments({}) })),
    );

    return NextResponse.json(
      {
        dbName: db.databaseName,
        generatedAt: new Date().toISOString(),
        format: "MongoDB Extended JSON (canonical)",
        totalDocuments: collections.reduce((sum, c) => sum + c.count, 0),
        collections,
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "Failed to build backup manifest" },
      { status: 500 },
    );
  }
}
