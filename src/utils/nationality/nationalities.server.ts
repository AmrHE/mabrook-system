/**
 * Server-side source of truth for valid nationalities: the static dataset
 * (via {@link ../nationality/normalize}) merged with admin-added deltas
 * ({@link ../../models/NationalityAddition}).
 *
 * SERVER-ONLY (hits Mongo). The client dropdown fetches through /api/nationalities.
 * Matching is fold-based and always returns/stores the canonical spelling.
 */
import { initDb } from "@/lib/mongoose";
import { NationalityAddition } from "@/models/NationalityAddition";
import { foldArabic } from "@/utils/geo/foldArabic";
import { NATIONALITY_LABELS, resolveNationalityStatic } from "./normalize";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

type LeanAddition = { name: string };

/** All canonical nationalities (dataset ∪ custom), Arabic-sorted. */
export async function getNationalities(): Promise<string[]> {
  await initDb();
  const custom = (await NationalityAddition.find({}).select("name").lean()) as unknown as LeanAddition[];
  const byFold = new Map<string, string>();
  for (const name of NATIONALITY_LABELS) byFold.set(foldArabic(name), name);
  for (const c of custom) {
    const key = foldArabic(c.name);
    if (!byFold.has(key)) byFold.set(key, c.name);
  }
  return [...byFold.values()].sort((a, b) => collator.compare(a, b));
}

/**
 * Canonical nationality for a raw value, or null if unknown. Checks the static
 * dataset first, then admin additions (fold-matched).
 */
export async function resolveNationality(value?: string | null): Promise<string | null> {
  if (!value || !value.trim()) return null;
  const staticHit = resolveNationalityStatic(value);
  if (staticHit) return staticHit;
  await initDb();
  const key = foldArabic(value);
  const custom = (await NationalityAddition.find({}).select("name").lean()) as unknown as LeanAddition[];
  const hit = custom.find((c) => foldArabic(c.name) === key);
  return hit ? hit.name : null;
}
