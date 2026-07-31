/**
 * Server-side source of truth for valid app names (the `Mom.installedApp` picker).
 * There is no bundled base list — every app is admin-added
 * ({@link ../../models/AppAddition}) via the settings page.
 *
 * SERVER-ONLY (hits Mongo). The client dropdown fetches through /api/apps.
 * Matching is fold-based (case-insensitive, Arabic-variant tolerant) and always
 * returns/stores the canonical spelling.
 */
import { initDb } from "@/lib/mongoose";
import { AppAddition } from "@/models/AppAddition";
import { foldArabic } from "@/utils/geo/foldArabic";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

type LeanAddition = { name: string };

/** All canonical app names, de-duplicated by fold and sorted. */
export async function getApps(): Promise<string[]> {
  await initDb();
  const custom = (await AppAddition.find({}).select("name").lean()) as unknown as LeanAddition[];
  const byFold = new Map<string, string>();
  for (const c of custom) {
    const key = foldArabic(c.name);
    if (!byFold.has(key)) byFold.set(key, c.name);
  }
  return [...byFold.values()].sort((a, b) => collator.compare(a, b));
}

/** Canonical app name for a raw value, or null if unknown (fold-matched). */
export async function resolveApp(value?: string | null): Promise<string | null> {
  if (!value || !value.trim()) return null;
  const key = foldArabic(value);
  await initDb();
  const custom = (await AppAddition.find({}).select("name").lean()) as unknown as LeanAddition[];
  const hit = custom.find((c) => foldArabic(c.name) === key);
  return hit ? hit.name : null;
}

/**
 * Canonicalize a raw list of app names against the valid set: folds/dedups,
 * drops unknown values, and returns the canonical spellings. One DB read.
 */
export async function resolveApps(values?: unknown): Promise<string[]> {
  if (!Array.isArray(values) || values.length === 0) return [];
  const canonical = await getApps();
  const byFold = new Map(canonical.map((n) => [foldArabic(n), n]));
  const out = new Set<string>();
  for (const v of values) {
    const hit = byFold.get(foldArabic(String(v ?? "")));
    if (hit) out.add(hit);
  }
  return [...out];
}
