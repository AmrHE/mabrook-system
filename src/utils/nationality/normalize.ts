/**
 * Canonical resolution + display folding for `Mom.nationality`.
 *
 * The source of truth is {@link NATIONALITIES} (feminine Arabic nisba + aliases).
 * This module builds a folded alias→canonical index over it and exposes:
 * - {@link resolveNationalityStatic} — raw value → canonical label, or null.
 * - {@link isSaudi} — true when a raw value resolves to سعودية.
 * - {@link normalizeNationality} — display label: canonical if known, else a
 *   trimmed/title-cased fallback, empty/unknown → "غير محدد".
 * - {@link NATIONALITY_LABELS} — the canonical list for the dropdown (Arabic-sorted).
 *
 * Matching folds via `foldArabic` (tashkeel, ة/ه, أإآ/ا, ى/ي, case, spacing) with
 * a leading-"ال" strip fallback. Extend coverage by editing the dataset; runtime
 * admin additions are merged server-side in {@link ./nationalities.server}.
 */

import { foldArabic as fold } from "@/utils/geo/foldArabic";
import { NATIONALITIES } from "./nationalities.data";

export const UNKNOWN_LABEL = "غير محدد";
export const SAUDI_LABEL = "سعودية";

const HAS_LATIN = /[a-zA-Z]/;
const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

// Folded alias → canonical. Canonical labels are indexed onto themselves too.
const ALIAS_INDEX = new Map<string, string>();
for (const { canonical, aliases } of NATIONALITIES) {
  for (const spelling of [canonical, ...aliases]) {
    const key = fold(spelling);
    if (key && !ALIAS_INDEX.has(key)) ALIAS_INDEX.set(key, canonical);
  }
}

/** Canonical labels for the dropdown, Arabic-sorted. */
export const NATIONALITY_LABELS: string[] = NATIONALITIES.map((n) => n.canonical).sort((a, b) =>
  collator.compare(a, b),
);

/**
 * Canonical nationality for a raw value, or null if unknown. Tries the folded
 * value, then the same with a leading "ال" removed (so "اليمن" resolves even if
 * only "يمن" were listed).
 */
export function resolveNationalityStatic(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  const f = fold(value);
  return ALIAS_INDEX.get(f) ?? ALIAS_INDEX.get(f.replace(/^ال/, "")) ?? null;
}

export function isSaudi(value?: string | null): boolean {
  return resolveNationalityStatic(value) === SAUDI_LABEL;
}

function titleCase(value: string): string {
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * Display label for a raw nationality value:
 * - empty/null → "غير محدد"
 * - a known nationality (any spelling) → its canonical feminine nisba
 * - otherwise: Latin text title-cased, other Arabic text trimmed/space-collapsed
 */
export function normalizeNationality(value?: string | null): string {
  if (!value) return UNKNOWN_LABEL;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return UNKNOWN_LABEL;
  const canonical = resolveNationalityStatic(collapsed);
  if (canonical) return canonical;
  return HAS_LATIN.test(collapsed) ? titleCase(collapsed) : collapsed;
}
