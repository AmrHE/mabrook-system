/**
 * Shared Arabic text folding used to match spelling variants of the same value
 * (e.g. جدة vs جده, تشكيل/tatweel, extra spaces). Extracted so both nationality
 * normalization ({@link ../nationality/normalize}) and the geo/location matching
 * (canonical city/district lookup + duplicate cleanup) fold identically.
 *
 * Folding is for MATCHING only — never store a folded value; keep the canonical
 * display spelling.
 */

// Arabic tashkeel (U+064B–U+0652) + tatweel (U+0640).
const ARABIC_MARKS = new RegExp("[\\u064B-\\u0652\\u0640]", "g");

/** Lowercase, strip Arabic diacritics/tatweel, collapse whitespace. */
export function cleanArabic(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fold Arabic letter variants so spelling differences match (matching only). */
export function foldArabic(value: string): string {
  return cleanArabic(value)
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

/**
 * District fold: like {@link foldArabic} but also drops a leading "حي" token, so
 * dataset names ("حي العمل") match values typed without the prefix ("العمل").
 */
export function foldDistrict(value: string): string {
  return foldArabic(value).replace(/^حي\s+/, "");
}
