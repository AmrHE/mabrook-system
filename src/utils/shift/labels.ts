import { shiftCloseReason } from "@/models/enum.constants";

/**
 * Arabic labels for the shift enums, in one place so server routes (CSV rows,
 * report columns) and client components (tables, charts) can never disagree.
 * Same shared-config pattern as `src/utils/leave/labels.ts`.
 *
 * LOGOUT and DUPLICATE are no longer written but still appear in historical
 * rows, so their labels must stay.
 */
export const CLOSE_REASON_AR: Record<string, string> = {
  [shiftCloseReason.MANUAL]: "يدوي",
  [shiftCloseReason.LOGOUT]: "تسجيل خروج",
  [shiftCloseReason.MAX_DURATION]: "تجاوز المدة",
  [shiftCloseReason.INACTIVITY]: "خمول",
  [shiftCloseReason.DUPLICATE]: "مكرر",
  [shiftCloseReason.DAY_ROLLOVER]: "انتهاء اليوم",
};

export const closeReasonLabel = (v?: string) => (v ? CLOSE_REASON_AR[v] ?? v : "");

/**
 * Close reasons that mean "the employee walked away without ending the shift".
 * MANUAL is excluded by definition; DUPLICATE was a system artefact, not a
 * behaviour, so it is excluded too.
 */
export const FORGOT_CLOSE_REASONS: string[] = [
  shiftCloseReason.MAX_DURATION,
  shiftCloseReason.INACTIVITY,
  shiftCloseReason.DAY_ROLLOVER,
];

/** `"09:12 - 12:30"`, or `"09:12 - الآن"` for the session still running. */
export function formatSessionSpan(
  start?: Date | string | null,
  end?: Date | string | null,
  timeZone = "Asia/Riyadh",
): string {
  const t = (d: Date | string) =>
    new Date(d).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  if (!start) return "";
  return `${t(start)} - ${end ? t(end) : "الآن"}`;
}

/** `"1 س 30 د"` from a minute count. */
export function formatMinutes(minutes?: number | null): string {
  const total = Math.max(0, Math.round(minutes ?? 0));
  return `${Math.floor(total / 60)} س ${total % 60} د`;
}
