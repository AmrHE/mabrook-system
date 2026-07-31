import mongoose from "mongoose";
import { shiftStatus, shiftCloseReason, fenceStatus } from "./enum.constants";

const ShiftSchema = new mongoose.Schema({
  // NOTE: default must be the `Date.now` reference, NOT `Date.now()` — the latter
  // is evaluated once at module load and would stamp every shift with the same time.
  createdAt: {
    type: Date,
    default: Date.now,
  },

  startTime: {
    type: Date,
    default: Date.now,
  },

  endTime: {
    type: Date,
    default: undefined,
  },

  status: {
    type: String,
    enum: shiftStatus,
    default: shiftStatus.IN_PROGRESS,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  // Primary hospital the employee picked when starting this shift. The shift's
  // check-in geofence is measured against this hospital's coordinates.
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
  },

  // Geofence classification of the shift check-in (soft; never blocks). See fenceStatus.
  startFenceStatus: {
    type: String,
    enum: fenceStatus,
    default: undefined,
  },
  // Distance (meters) from the hospital at check-in; undefined when not evaluable.
  startDistanceMeters: { type: Number, default: undefined },

  // Biometric-style check-in / check-out coordinates (best-effort; may be undefined).
  // Same inline shape as the proven Visit.location field.
  startLocation: {
    lat: Number,
    lng: Number,
  },
  endLocation: {
    lat: Number,
    lng: Number,
  },

  // Timestamp of the employee's last real work event (visit/mom) during this shift.
  // Used by the auto-close job so idle time never counts as worked hours.
  lastActivityAt: { type: Date, default: undefined },

  // Set when the shift was ended by the auto-close job rather than the employee.
  autoClosed: { type: Boolean, default: false },
  closeReason: { type: String, enum: shiftCloseReason, default: undefined },
});

// Indexes powering create-idempotency, endShift, getCurrentShift, the cron scan,
// open-shifts, shift-patterns, and per-user range lookups.
ShiftSchema.index({ userId: 1, status: 1 });
ShiftSchema.index({ status: 1, startTime: 1 });
ShiftSchema.index({ userId: 1, startTime: -1 });
// Powers the geofence compliance report's status filtering.
ShiftSchema.index({ startFenceStatus: 1, startTime: -1 });

// Structural guarantee of "<= 1 open shift per user". Add this ONLY after the
// historical cleanup has collapsed existing duplicates (see plan §E), otherwise the
// index build fails on legacy data. Left commented until then.
// ShiftSchema.index(
//   { userId: 1 },
//   { unique: true, partialFilterExpression: { status: shiftStatus.IN_PROGRESS } },
// );

export const Shift = mongoose.models.Shift || mongoose.model("Shift", ShiftSchema);
