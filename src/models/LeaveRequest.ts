import mongoose from "mongoose";
import { leaveType, leaveStatus, leavePayMode } from "./enum.constants";

/**
 * A time-off request: a delay permit, an early leave, a vacation, or a casual day.
 *
 * Anyone may submit one (employees, warehouse users and admins alike); only an
 * ADMIN may decide it, and never their own — see `src/utils/leave/decide.ts`.
 *
 * Days are stored as `YYYY-MM-DD` **Riyadh calendar days**, not instants. A day
 * off is a calendar day rather than a 24h window, and a UTC timestamp would
 * drift across the +03 boundary. The format sorts lexicographically, so window
 * queries are plain string comparisons, and shift aggregations project the same
 * shape (`$dateToString`) so attendance and leave intersect as sets of day keys.
 */
const LeaveRequestSchema = new mongoose.Schema({
  // NOTE: default must be the `Date.now` reference, NOT `Date.now()` — the latter
  // is evaluated once at module load and would stamp every document with the same time.
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // The requester. Always taken from the verified JWT, never from the request body.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  type: {
    type: String,
    enum: leaveType,
    required: true,
  },

  // Inclusive Riyadh calendar-day span. Equal for permits and casual days;
  // a vacation may cover several days.
  startDay: { type: String, required: true },
  endDay: { type: String, required: true },

  // Denormalised span (endDay - startDay + 1), kept so reports and CSV rows
  // don't have to re-derive it. Always 1 for permits and casual days.
  daysCount: { type: Number, default: 1 },

  // Length of a partial-day permit. Required for DELAY_PERMIT / EARLY_LEAVE,
  // absent on full-day types. Note this never scales the money: an unpaid permit
  // costs a flat quarter-day regardless of length (see leaveLedger.ts).
  minutes: { type: Number, default: undefined },

  // Employee's justification.
  reason: { type: String, default: "" },

  status: {
    type: String,
    enum: leaveStatus,
    default: leaveStatus.PENDING,
  },

  // Set only when APPROVED, and only by the deciding admin — the requester
  // never chooses whether their own leave is paid.
  payMode: {
    type: String,
    enum: leavePayMode,
    default: undefined,
  },

  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: undefined,
  },
  decidedAt: { type: Date, default: undefined },
  decisionNote: { type: String, default: "" },

  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: undefined },
});

// Employee's own history, newest span first.
LeaveRequestSchema.index({ userId: 1, startDay: -1 });
// The overlap guard on create: non-terminal requests for one user in a day span.
LeaveRequestSchema.index({ userId: 1, status: 1, startDay: 1, endDay: 1 });
// Report/ledger window scan across all users.
LeaveRequestSchema.index({ startDay: 1, endDay: 1, status: 1 });
// Admin inbox: pending requests, newest first.
LeaveRequestSchema.index({ status: 1, createdAt: -1 });

export const LeaveRequest =
  mongoose.models.LeaveRequest || mongoose.model("LeaveRequest", LeaveRequestSchema);
