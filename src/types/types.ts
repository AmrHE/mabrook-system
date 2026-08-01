import { shiftStatus, shiftCloseReason, fenceStatus } from "../models/enum.constants";

export interface GeoPoint {
  lat?: number;
  lng?: number;
}

/** Minimal hospital shape returned by the assigned-hospitals endpoint / pickers. */
export interface HospitalRef {
  _id: string;
  name: string;
  location?: GeoPoint;
}

/** One check-in → check-out within a day-shift. */
export interface ShiftSegmentType {
  startTime: string;
  endTime?: string;
  hospitalId?: string | HospitalRef;
  startLocation?: GeoPoint;
  endLocation?: GeoPoint;
  startFenceStatus?: fenceStatus;
  startDistanceMeters?: number;
  autoClosed?: boolean;
  closeReason?: shiftCloseReason;
}

/**
 * One employee-day. `segments` is authoritative; every other field below is a
 * projection of it maintained by `utils/shift/rollup.ts`.
 *
 * For the dashboard's view of the current day, prefer `DayShiftDTO` from
 * `utils/shift/currentState.ts` — it carries the populated hospital names.
 */
export interface ShiftType {
  _id: string;
  createdAt: string;
  /** `YYYY-MM-DD` (Riyadh) of the day's first check-in. */
  dayKey?: string;
  segments?: ShiftSegmentType[];
  /** Sum of the closed sessions — the day's worked time, excluding breaks. */
  workedMinutes?: number;
  sessionsCount?: number;
  /** Start of the running session; absent once the day is closed. */
  currentSegmentStartedAt?: string;
  /** Day's first check-in. */
  startTime: string;
  /** Day's last check-out. */
  endTime?: string | undefined;
  status: shiftStatus;
  userId: string;
  hospitalId?: string | HospitalRef;
  startFenceStatus?: fenceStatus;
  startDistanceMeters?: number;
  startLocation?: GeoPoint;
  endLocation?: GeoPoint;
  lastActivityAt?: string;
  autoClosed?: boolean;
  closeReason?: shiftCloseReason;
}

export interface SettingsType {
  expectedStartFrom: string;
  expectedStartTo: string;
  expectedHoursPerDay: number;
  expectedDaysPerWeek: number;
  graceMinutes: number;
  maxShiftHours: number;
  inactivityMinutes: number;
  leaveMaxRetroDays: number;
  geofenceRadiusMeters: number;
  outOfStockThreshold: number;
  lowStockThreshold: number;
  lowMomRateRatioPercent: number;
  lowMomRateMinVisitMinutes: number;
  lowMomRateBaselineDays: number;
  timezone: string;
}
