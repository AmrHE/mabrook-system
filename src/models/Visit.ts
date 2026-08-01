import mongoose from 'mongoose';
import { shiftStatus, fenceStatus } from './enum.constants';

/**
 * One continuous stretch of work inside a visit. Mirrors ShiftSegment: ending a
 * visit and resuming it later appends a segment rather than rewriting the
 * original times, so the gap in between is never counted as visit duration.
 */
const VisitSegmentSchema = new mongoose.Schema({
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: undefined },
  startLocation: { lat: Number, lng: Number },
  endLocation: { lat: Number, lng: Number },
});

const VisitSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },

  /** First check-in of the visit. */
  startTime: {
    type: Date,
    default: Date.now,
  },

  /** Last check-out; undefined while a session is running. */
  endTime: {
    type: Date,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
  },

  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
  },

  moms: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Mom',
    default: [],
  },

  // Where the employee was when the visit started / ended (device GPS), mirroring
  // the Shift model's startLocation / endLocation.
  startLocation: {
    lat: Number,
    lng: Number,
  },
  endLocation: {
    lat: Number,
    lng: Number,
  },

  // Geofence classification of the visit check-in against its hospital (soft; never blocks).
  startFenceStatus: {
    type: String,
    enum: fenceStatus,
    default: undefined,
  },
  startDistanceMeters: { type: Number, default: undefined },

  /** Sessions of this visit. Legacy rows have none and fall back to the span. */
  segments: { type: [VisitSegmentSchema], default: [] },

  /**
   * Sum of the CLOSED segments. Reports read this instead of
   * `endTime - startTime`, which would include any resume gap.
   */
  workedMinutes: { type: Number, default: 0 },
  sessionsCount: { type: Number, default: 0 },

  // Free-text note about the visit. Editable by any user who can reach the
  // visit, at any time, so the two audit fields are what tell you whose text
  // you are reading after an overwrite.
  notes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 2000,
  },
  notesUpdatedAt: { type: Date },
  notesUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  status : {
    type: String,
    enum: shiftStatus,
    default: shiftStatus.IN_PROGRESS,
  },

    isActive: {
    type: Boolean,
    default: true,
  },

  deletedAt: {
    type: Date,
    default: Date.now
  },
}, {
  /**
   * The indexes below are NEW — this collection previously had none — so
   * letting Mongoose build all five implicitly on a cold serverless start
   * would stall the first request against a large visits collection. They are
   * created explicitly and in the background by
   * `POST /api/shift/backfill-day-shifts?createIndex=true`.
   */
  autoIndex: false,
});

// Every visit query used to be a collection scan. These cover the dashboard's
// open/resumable lookups, the per-employee lists, the shift join in the
// analytics pipelines, and the hospital reports.
VisitSchema.index({ shiftId: 1 });
VisitSchema.index({ createdBy: 1, status: 1 });
VisitSchema.index({ createdBy: 1, createdAt: -1 });
VisitSchema.index({ isActive: 1, createdAt: -1 });
VisitSchema.index({ hospitalId: 1, createdAt: -1 });

export const Visit = mongoose.models.Visit || mongoose.model('Visit', VisitSchema);
