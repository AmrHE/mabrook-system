/**
 * Server-side source of truth for valid Saudi cities/districts, merging the
 * bundled national dataset ({@link ./saudiLocations.data}) with admin-added
 * deltas ({@link ../../models/LocationAddition}).
 *
 * SERVER-ONLY: pulls in the large static dataset + hits Mongo. The client-side
 * dropdown ({@link ../../components/LocationPicker}) never imports this — it goes
 * through /api/locations/*.
 *
 * Matching is fold-based (see {@link ./foldArabic}) so trivial spelling variants
 * (جدة/جده, tashkeel, spacing, and a leading "حي" on districts) resolve to the
 * one canonical entry. We always return/store the canonical display spelling.
 */
import { initDb } from "@/lib/mongoose";
import { LocationAddition } from "@/models/LocationAddition";
import { SAUDI_CITIES, SAUDI_DISTRICTS_BY_CITY } from "./saudiLocations.data";
import { foldArabic, foldDistrict } from "./foldArabic";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

// Folded lookup indexes over the static dataset, built once per process.
const CITY_BY_FOLD = new Map<string, string>(); // cityFold -> canonical city name
for (const c of SAUDI_CITIES) {
  const key = foldArabic(c.name);
  if (!CITY_BY_FOLD.has(key)) CITY_BY_FOLD.set(key, c.name);
}

// cityFold -> (districtFold -> canonical district name)
const DISTRICTS_BY_CITY_FOLD = new Map<string, Map<string, string>>();
for (const [cityName, districts] of Object.entries(SAUDI_DISTRICTS_BY_CITY)) {
  const m = new Map<string, string>();
  for (const d of districts) m.set(foldDistrict(d), d);
  DISTRICTS_BY_CITY_FOLD.set(foldArabic(cityName), m);
}

/**
 * Well-known colloquial/short city forms that don't fold-match the dataset's
 * full official names (National Address uses "مكة المكرمة" / "المدينة المنورة").
 * Extend as more surface in the cleanup's unmatched report. Left side is folded.
 */
const CITY_ALIASES: Record<string, string> = {
  "مكة": "مكة المكرمة",
  "المدينة": "المدينة المنورة",
};
const ALIAS_BY_FOLD = new Map<string, string>(
  Object.entries(CITY_ALIASES).map(([alias, canonical]) => [foldArabic(alias), canonical]),
);

/** Canonical city name from the dataset or a known alias, else undefined. */
function staticCityName(cityFold: string): string | undefined {
  return CITY_BY_FOLD.get(cityFold) ?? ALIAS_BY_FOLD.get(cityFold);
}

type LeanAddition = { name: string; city?: string };

/** All canonical city names (static ∪ custom), Arabic-sorted. */
export async function getCities(): Promise<string[]> {
  await initDb();
  const custom = (await LocationAddition.find({ kind: "city" }).select("name").lean()) as unknown as LeanAddition[];
  const byFold = new Map<string, string>();
  for (const c of SAUDI_CITIES) byFold.set(foldArabic(c.name), c.name);
  for (const c of custom) {
    const key = foldArabic(c.name);
    if (!byFold.has(key)) byFold.set(key, c.name);
  }
  return [...byFold.values()].sort((a, b) => collator.compare(a, b));
}

/** Canonical districts for a city (static ∪ custom), Arabic-sorted. Empty if none. */
export async function getDistricts(city: string): Promise<string[]> {
  if (!city) return [];
  await initDb();
  // Resolve aliases/short forms to the canonical city before looking up districts.
  const canonicalCity = staticCityName(foldArabic(city)) ?? city;
  const cityFold = foldArabic(canonicalCity);
  const byFold = new Map<string, string>();
  const staticDistricts = DISTRICTS_BY_CITY_FOLD.get(cityFold);
  if (staticDistricts) for (const [k, v] of staticDistricts) byFold.set(k, v);

  const custom = (await LocationAddition.find({ kind: "district" }).select("name city").lean()) as unknown as LeanAddition[];
  for (const d of custom) {
    if (foldArabic(d.city ?? "") !== cityFold) continue;
    const key = foldDistrict(d.name);
    if (!byFold.has(key)) byFold.set(key, d.name);
  }
  return [...byFold.values()].sort((a, b) => collator.compare(a, b));
}

/**
 * Canonical city display name for a raw value, or null if it isn't a known city.
 * Use for backend validation (null ⇒ reject) and to store the canonical spelling.
 */
export async function resolveCity(value?: string | null): Promise<string | null> {
  if (!value || !value.trim()) return null;
  const key = foldArabic(value);
  const staticHit = staticCityName(key);
  if (staticHit) return staticHit;
  await initDb();
  const custom = (await LocationAddition.find({ kind: "city" }).select("name").lean()) as unknown as LeanAddition[];
  const hit = custom.find((c) => foldArabic(c.name) === key);
  return hit ? hit.name : null;
}

/**
 * Canonical district display name for a raw value within a city, or null if it
 * isn't a known district of that city.
 */
export async function resolveDistrict(city?: string | null, value?: string | null): Promise<string | null> {
  if (!city || !value || !value.trim()) return null;
  const canonicalCity = staticCityName(foldArabic(city)) ?? city;
  const cityFold = foldArabic(canonicalCity);
  const dKey = foldDistrict(value);
  const staticHit = DISTRICTS_BY_CITY_FOLD.get(cityFold)?.get(dKey);
  if (staticHit) return staticHit;
  await initDb();
  const custom = (await LocationAddition.find({ kind: "district" }).select("name city").lean()) as unknown as LeanAddition[];
  const hit = custom.find((d) => foldArabic(d.city ?? "") === cityFold && foldDistrict(d.name) === dKey);
  return hit ? hit.name : null;
}
