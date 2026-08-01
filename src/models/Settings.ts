import mongoose from "mongoose";

/**
 * Org-wide, admin-editable configuration. Stored as a single document
 * (`key: "global"`); read/written through the atomic upsert helper in
 * `src/utils/settings/getSettings.ts`.
 */
const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "global" },

    // Flexible check-in window (local HH:mm). On-time = first arrival <= expectedStartTo (+grace).
    expectedStartFrom: { type: String, default: "10:00" },
    expectedStartTo: { type: String, default: "11:00" },

    // Target shift length / working schedule.
    expectedHoursPerDay: { type: Number, default: 4 },
    expectedDaysPerWeek: { type: Number, default: 5 },
    graceMinutes: { type: Number, default: 0 },

    // Auto-close thresholds (consumed by the close-stale-shifts cron).
    maxShiftHours: { type: Number, default: 6 },
    inactivityMinutes: { type: Number, default: 60 },

    // How many days back a leave/permit request may be dated. Retroactive
    // requests are useful (nobody files a sick day in advance) but an unbounded
    // window would let an old month's payroll be rewritten indefinitely.
    leaveMaxRetroDays: { type: Number, default: 7 },

    // Geofence radius (meters) applied to every hospital when classifying a
    // shift/visit check-in as IN_RANGE vs OUT_OF_RANGE. Generous default to
    // absorb indoor GPS drift.
    geofenceRadiusMeters: { type: Number, default: 200 },

    // Box/product stock-status thresholds. A box is "نفذ" (out) below
    // outOfStockThreshold, "منخفض" (low) below lowStockThreshold, else "متاح".
    // Must satisfy outOfStockThreshold < lowStockThreshold.
    outOfStockThreshold: { type: Number, default: 20 },
    lowStockThreshold: { type: Number, default: 50 },

    // Low-productivity visit flag. A visit is flagged when its moms-per-hour
    // falls below `lowMomRateRatioPercent`% of the team's pooled average over
    // the last `lowMomRateBaselineDays` days. Visits shorter than
    // `lowMomRateMinVisitMinutes` are neither judged nor counted in the average
    // (their rate hinges on a single mom). See utils/analytics/visitProductivity.ts.
    lowMomRateRatioPercent: { type: Number, default: 50 },
    lowMomRateMinVisitMinutes: { type: Number, default: 45 },
    lowMomRateBaselineDays: { type: Number, default: 90 },

    timezone: { type: String, default: "Asia/Riyadh" },
  },
  { timestamps: true },
);

export const Settings = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
