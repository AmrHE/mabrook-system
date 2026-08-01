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

export interface ShiftType {
  _id: string;
  createdAt: string;
  startTime: string;
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
