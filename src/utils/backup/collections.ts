/**
 * Shared helpers for the database backup endpoints (`/api/backup/*`).
 *
 * These read through the raw driver rather than the Mongoose models on purpose:
 * a backup must cover every collection that physically exists, not just the ones
 * whose model happens to be imported in src/lib/mongoose.ts.
 */

import mongoose from "mongoose";

type Db = NonNullable<typeof mongoose.connection.db>;

/** Live driver handle for the current connection. Call after `initDb()`. */
export function getDb(): Db {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not ready");
  return db;
}

/**
 * Names of the collections eligible for backup — every user collection, sorted,
 * with views, timeseries buckets and internal `system.*` collections excluded.
 *
 * Doubles as the allowlist for the `?name=` param on the collection endpoint, so
 * an unchecked query value can never reach `db.collection()`.
 */
export async function listBackupCollections(): Promise<string[]> {
  const infos = await getDb().listCollections().toArray();
  return infos
    .filter((info) => (info.type ?? "collection") === "collection" && !info.name.startsWith("system."))
    .map((info) => info.name)
    .sort();
}
