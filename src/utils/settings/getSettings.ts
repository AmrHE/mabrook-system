import { Settings } from "@/models/Settings";
import { TIMEZONE } from "@/utils/date/range";
import { OUT_OF_STOCK_THRESHOLD, LOW_STOCK_THRESHOLD } from "@/utils/stock/thresholds";

/** Single source of truth for defaults — reused by the reader and the PUT validator. */
export const DEFAULT_SETTINGS = {
  key: "global",
  expectedStartFrom: "10:00",
  expectedStartTo: "11:00",
  expectedHoursPerDay: 4,
  expectedDaysPerWeek: 5,
  graceMinutes: 0,
  maxShiftHours: 6,
  inactivityMinutes: 60,
  leaveMaxRetroDays: 7,
  geofenceRadiusMeters: 200,
  outOfStockThreshold: OUT_OF_STOCK_THRESHOLD,
  lowStockThreshold: LOW_STOCK_THRESHOLD,
  timezone: TIMEZONE,
} as const;

export interface AttendanceSettings {
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
  timezone: string;
}

/**
 * Read the singleton settings doc, creating it with defaults on first access.
 * The atomic upsert + unique `key` index guarantees exactly one document even
 * under concurrent requests. Not cached — admin edits must take effect immediately.
 */
export async function getSettings(): Promise<AttendanceSettings> {
  const doc = await Settings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: DEFAULT_SETTINGS },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<AttendanceSettings & { _id: unknown }>();

  // `doc` is always present after an upsert with `new: true`, but guard for types.
  return {
    expectedStartFrom: doc?.expectedStartFrom ?? DEFAULT_SETTINGS.expectedStartFrom,
    expectedStartTo: doc?.expectedStartTo ?? DEFAULT_SETTINGS.expectedStartTo,
    expectedHoursPerDay: doc?.expectedHoursPerDay ?? DEFAULT_SETTINGS.expectedHoursPerDay,
    expectedDaysPerWeek: doc?.expectedDaysPerWeek ?? DEFAULT_SETTINGS.expectedDaysPerWeek,
    graceMinutes: doc?.graceMinutes ?? DEFAULT_SETTINGS.graceMinutes,
    maxShiftHours: doc?.maxShiftHours ?? DEFAULT_SETTINGS.maxShiftHours,
    inactivityMinutes: doc?.inactivityMinutes ?? DEFAULT_SETTINGS.inactivityMinutes,
    leaveMaxRetroDays: doc?.leaveMaxRetroDays ?? DEFAULT_SETTINGS.leaveMaxRetroDays,
    geofenceRadiusMeters: doc?.geofenceRadiusMeters ?? DEFAULT_SETTINGS.geofenceRadiusMeters,
    outOfStockThreshold: doc?.outOfStockThreshold ?? DEFAULT_SETTINGS.outOfStockThreshold,
    lowStockThreshold: doc?.lowStockThreshold ?? DEFAULT_SETTINGS.lowStockThreshold,
    timezone: doc?.timezone ?? DEFAULT_SETTINGS.timezone,
  };
}
