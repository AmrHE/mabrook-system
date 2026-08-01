import mongoose from "mongoose";
import { shiftStatus, shiftCloseReason, fenceStatus } from "./enum.constants";

/**
 * One check-in → check-out. A shift holds an array of these, so an employee who
 * checks out and resumes later in the day extends the SAME shift document
 * rather than creating a second one.
 *
 * Everything that is per-check-in lives here — GPS fix, hospital, geofence
 * verdict, close reason — because the top-level copies on the shift only
 * describe the first and last segment.
 */
const ShiftSegmentSchema = new mongoose.Schema({
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: undefined },

  // The hospital picked for THIS session; an employee may resume elsewhere.
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },

  startLocation: { lat: Number, lng: Number },
  endLocation: { lat: Number, lng: Number },

  startFenceStatus: { type: String, enum: fenceStatus, default: undefined },
  startDistanceMeters: { type: Number, default: undefined },

  autoClosed: { type: Boolean, default: false },
  closeReason: { type: String, enum: shiftCloseReason, default: undefined },
});

const ShiftSchema = new mongoose.Schema(
  {
    // NOTE: default must be the `Date.now` reference, NOT `Date.now()` — the latter
    // is evaluated once at module load and would stamp every shift with the same time.
    createdAt: {
      type: Date,
      default: Date.now,
    },

    /**
     * `YYYY-MM-DD` in Asia/Riyadh — the day of the FIRST check-in, immutable.
     *
     * A shift that runs past midnight keeps the day it started on: attendance
     * asks "which day did you come to work", and splitting at midnight would
     * manufacture a 00:00 arrival that reads as absurdly punctual.
     */
    dayKey: { type: String },

    /** Authoritative record of the day's work. Never empty. */
    segments: { type: [ShiftSegmentSchema], default: [] },

    /**
     * Sum of the CLOSED segments. This — not `endTime - startTime` — is the
     * day's worked time: the span would include the gaps between sessions and
     * inflate a split day by hours.
     */
    workedMinutes: { type: Number, default: 0 },

    /** `segments.length`, denormalised so reports don't have to unwind. */
    sessionsCount: { type: Number, default: 0 },

    /** Start of the running segment; undefined once the day is closed. */
    currentSegmentStartedAt: { type: Date, default: undefined },

    /* ---------------------------------------------------------------- *
     * Everything below is DERIVED from `segments[]` by
     * `applyShiftRollups()` (src/utils/shift/rollup.ts). The meanings are
     * unchanged from before shifts collapsed by day, which is what lets the
     * analytics pipelines keep reading them.
     * ---------------------------------------------------------------- */

    /** First check-in of the day. */
    startTime: {
      type: Date,
      default: Date.now,
    },

    /** Last check-out of the day; undefined while a session is running. */
    endTime: {
      type: Date,
      default: undefined,
    },

    /** IN_PROGRESS iff the last segment is still open. */
    status: {
      type: String,
      enum: shiftStatus,
      default: shiftStatus.IN_PROGRESS,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Primary hospital = the one picked at the day's FIRST check-in. Later
    // sessions record their own hospital on the segment.
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },

    // Geofence classification of the day's first check-in (soft; never blocks).
    // Per-session verdicts live on `segments[].startFenceStatus`, which is what
    // the compliance report unwinds.
    startFenceStatus: {
      type: String,
      enum: fenceStatus,
      default: undefined,
    },
    startDistanceMeters: { type: Number, default: undefined },

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

    // Outcome of the last CLOSED segment — "how did this day finally end".
    autoClosed: { type: Boolean, default: false },
    closeReason: { type: String, enum: shiftCloseReason, default: undefined },
  },
  {
    /**
     * Index builds are triggered explicitly by the backfill endpoint, never
     * implicitly. `initDb` connects lazily per serverless invocation, so an
     * autoIndex build over a year of shifts on a cold start is a real stall.
     */
    autoIndex: false,
  },
);

// Indexes powering create/endShift, getCurrentShift, the cron scan,
// open-shifts, shift-patterns, and per-user range lookups.
ShiftSchema.index({ userId: 1, status: 1 });
ShiftSchema.index({ status: 1, startTime: 1 });
ShiftSchema.index({ userId: 1, startTime: -1 });
// Powers the geofence compliance report's status filtering.
ShiftSchema.index({ startFenceStatus: 1, startTime: -1 });
// The cron measures inactivity from the open segment, not the day.
ShiftSchema.index({ status: 1, currentSegmentStartedAt: 1 });

/**
 * The structural guarantee of "one shift per employee per day".
 *
 * `partialFilterExpression` is belt-and-braces: without it a document missing
 * `dayKey` would index as null, and two such documents for one user would fail
 * the build. Created by `POST /api/shift/backfill-day-shifts?createIndex=true`
 * once the historical collapse has verified there are no duplicates left.
 */
ShiftSchema.index(
  { userId: 1, dayKey: 1 },
  { unique: true, partialFilterExpression: { dayKey: { $type: "string" } } },
);

export const Shift = mongoose.models.Shift || mongoose.model("Shift", ShiftSchema);
