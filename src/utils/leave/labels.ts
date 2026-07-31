import { leaveType, leaveStatus, leavePayMode } from "@/models/enum.constants";

/**
 * Arabic labels for the leave enums, in one place so server routes (CSV rows,
 * report columns) and client components (badges, selects) can never disagree.
 * Same shared-config pattern as `src/utils/analytics/dataQualityCategories.ts`.
 */

export const LEAVE_TYPE_AR: Record<string, string> = {
  [leaveType.DELAY_PERMIT]: "استئذان تأخير",
  [leaveType.EARLY_LEAVE]: "استئذان انصراف مبكر",
  [leaveType.VACATION]: "إجازة",
  [leaveType.CASUAL]: "يوم عارض",
};

export const LEAVE_STATUS_AR: Record<string, string> = {
  [leaveStatus.PENDING]: "قيد المراجعة",
  [leaveStatus.APPROVED]: "معتمد",
  [leaveStatus.REJECTED]: "مرفوض",
  [leaveStatus.CANCELLED]: "ملغي",
};

export const LEAVE_PAY_MODE_AR: Record<string, string> = {
  [leavePayMode.PAID]: "مدفوع",
  [leavePayMode.UNPAID]: "غير مدفوع",
};

export const leaveTypeLabel = (v?: string) => (v ? LEAVE_TYPE_AR[v] ?? v : "—");
export const leaveStatusLabel = (v?: string) => (v ? LEAVE_STATUS_AR[v] ?? v : "—");
export const leavePayModeLabel = (v?: string) => (v ? LEAVE_PAY_MODE_AR[v] ?? v : "—");

/** Ordered options for the request form's type `<Select>`. */
export const LEAVE_TYPE_OPTIONS = [
  { value: leaveType.DELAY_PERMIT, label: LEAVE_TYPE_AR[leaveType.DELAY_PERMIT] },
  { value: leaveType.EARLY_LEAVE, label: LEAVE_TYPE_AR[leaveType.EARLY_LEAVE] },
  { value: leaveType.CASUAL, label: LEAVE_TYPE_AR[leaveType.CASUAL] },
  { value: leaveType.VACATION, label: LEAVE_TYPE_AR[leaveType.VACATION] },
];

/** `2026-08-03` or `2026-08-03 ← 2026-08-05` for a multi-day span. */
export function formatLeaveSpan(startDay?: string, endDay?: string): string {
  if (!startDay) return "—";
  if (!endDay || endDay === startDay) return startDay;
  return `${startDay} — ${endDay}`;
}

/** "ساعة و30 دقيقة" style duration for a permit's `minutes`. */
export function formatPermitMinutes(minutes?: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return h === 1 ? "ساعة" : `${h} ساعات`;
  return `${h === 1 ? "ساعة" : `${h} ساعات`} و${m} دقيقة`;
}
