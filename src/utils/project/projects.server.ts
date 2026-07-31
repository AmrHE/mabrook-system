/**
 * Server-side source of truth for valid projects: the seeded base ("mabrook")
 * merged with admin-added deltas ({@link ../../models/ProjectAddition}).
 *
 * SERVER-ONLY (hits Mongo). The client dropdown fetches through /api/projects.
 * Matching is fold-based (case-insensitive, Arabic-variant tolerant) and always
 * returns/stores the canonical spelling.
 */
import { initDb } from "@/lib/mongoose";
import { ProjectAddition } from "@/models/ProjectAddition";
import { foldArabic } from "@/utils/geo/foldArabic";

/** Seeded base every org starts with. Admins add more via /api/projects/add. */
export const PROJECT_BASE = ["mabrook"] as const;

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

type LeanAddition = { name: string };

/** All canonical projects (base ∪ custom), de-duplicated by fold and sorted. */
export async function getProjects(): Promise<string[]> {
  await initDb();
  const custom = (await ProjectAddition.find({}).select("name").lean()) as unknown as LeanAddition[];
  const byFold = new Map<string, string>();
  for (const name of PROJECT_BASE) byFold.set(foldArabic(name), name);
  for (const c of custom) {
    const key = foldArabic(c.name);
    if (!byFold.has(key)) byFold.set(key, c.name);
  }
  return [...byFold.values()].sort((a, b) => collator.compare(a, b));
}

/**
 * Canonical project for a raw value, or null if unknown. Checks the static base
 * first, then admin additions (fold-matched).
 */
export async function resolveProject(value?: string | null): Promise<string | null> {
  if (!value || !value.trim()) return null;
  const key = foldArabic(value);
  for (const name of PROJECT_BASE) if (foldArabic(name) === key) return name;
  await initDb();
  const custom = (await ProjectAddition.find({}).select("name").lean()) as unknown as LeanAddition[];
  const hit = custom.find((c) => foldArabic(c.name) === key);
  return hit ? hit.name : null;
}
