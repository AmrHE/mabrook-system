export enum userRoles {
  EMPLOYEE = "EMPLOYEE",
  ADMIN = "ADMIN",
  WAREHOUSE = "WAREHOUSE",
}


export enum shiftStatus {
  IN_PROGRESS = "IN_PROGRESS",
  ENDED = "ENDED"
}

/**
 * Why a shift SESSION ended. Since shifts collapse to one document per Riyadh
 * day, this lives on each `segments[]` entry; the copy on the shift itself is
 * the LAST segment's, i.e. "how did this day finally end".
 *
 * LOGOUT and DUPLICATE are retired for new writes — logging out no longer ends
 * a shift, and the {userId, dayKey} unique index makes duplicates unreachable —
 * but they stay here (and in the Arabic label map) for historical rows.
 */
export enum shiftCloseReason {
  MANUAL = "MANUAL",             // employee pressed "end"
  LOGOUT = "LOGOUT",             // retired: closed during logout
  MAX_DURATION = "MAX_DURATION", // auto: worked time >= maxShiftHours
  INACTIVITY = "INACTIVITY",     // auto: now - lastActivity >= inactivityMinutes
  DUPLICATE = "DUPLICATE",       // retired: extra concurrent open shift collapsed
  DAY_ROLLOVER = "DAY_ROLLOVER", // auto: still open when a new Riyadh day's shift started
}

// Geofence classification of a shift/visit check-in relative to its hospital.
// Soft mode: a check-in is NEVER blocked — this is recorded for admin review.
export enum fenceStatus {
  IN_RANGE = "IN_RANGE",                             // within the global radius of the hospital
  OUT_OF_RANGE = "OUT_OF_RANGE",                     // valid GPS fix, but farther than the radius
  NO_LOCATION_FIX = "NO_LOCATION_FIX",               // GPS denied/unavailable — can't evaluate
  HOSPITAL_NOT_CONFIGURED = "HOSPITAL_NOT_CONFIGURED", // hospital has no coordinates set yet
}

// Kind of time-off request. PERMITS are partial-day excuses on a single day;
// the other two are full-day absences (VACATION may span several days).
export enum leaveType {
  DELAY_PERMIT = "DELAY_PERMIT", // استئذان تأخير — authorised late arrival, single day
  EARLY_LEAVE = "EARLY_LEAVE",   // استئذان انصراف مبكر — authorised early departure, single day
  VACATION = "VACATION",         // إجازة — one or more full days
  CASUAL = "CASUAL",             // يوم عارض — a single full day
}

/** The two partial-day permit types, which share every validation rule. */
export const LEAVE_PERMIT_TYPES = [leaveType.DELAY_PERMIT, leaveType.EARLY_LEAVE] as const;
/** The two full-day types, which consume whole working days. */
export const LEAVE_FULL_DAY_TYPES = [leaveType.VACATION, leaveType.CASUAL] as const;

export enum leaveStatus {
  PENDING = "PENDING",     // awaiting an admin decision
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED", // withdrawn by the requester while still pending
}

/**
 * Whether an approved request costs the employee money. Chosen by the approving
 * admin, never by the requester. UNPAID full-day leave is deducted exactly like
 * a no-show; an UNPAID permit is deducted a flat quarter of a day.
 */
export enum leavePayMode {
  PAID = "PAID",
  UNPAID = "UNPAID",
}