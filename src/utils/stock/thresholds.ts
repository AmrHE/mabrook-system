/**
 * Stock-status thresholds. The live values are admin-editable in Settings
 * (see `Settings` model + `/api/settings`); the constants below are the
 * defaults used to seed Settings and as a fallback when a value is missing.
 *
 * A box is:
 *   - "نفذ"   (out of stock)  when quantity < outOfStock
 *   - "منخفض" (low stock)     when outOfStock <= quantity < lowStock
 *   - "متاح"  (available)     when quantity >= lowStock
 */

/** Default: below this on-hand quantity a box is treated as out of stock. */
export const OUT_OF_STOCK_THRESHOLD = 20;

/** Default: below this (but at/above out-of-stock) a box is low and needs restocking. */
export const LOW_STOCK_THRESHOLD = 50;

export type StockStatus = "متاح" | "منخفض" | "نفذ";

/**
 * Map an on-hand quantity to its Arabic stock-status label, using the given
 * thresholds (falling back to the defaults above).
 */
export function stockStatus(
  quantity: number | null | undefined,
  outOfStock: number = OUT_OF_STOCK_THRESHOLD,
  lowStock: number = LOW_STOCK_THRESHOLD,
): StockStatus {
  const q = quantity ?? 0;
  if (q < outOfStock) return "نفذ";
  if (q < lowStock) return "منخفض";
  return "متاح";
}
