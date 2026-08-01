/* eslint-disable @typescript-eslint/no-explicit-any */
import { shiftStatus } from "@/models/enum.constants";
import { riyadhDayKey } from "@/utils/date/range";

/**
 * A shift is one document per employee per Riyadh calendar day. Each
 * check-in → check-out is a SEGMENT; the top-level fields are pure projections
 * of `segments[]`, which keeps their meaning identical to the pre-collapse
 * schema (so punctuality, forgot-to-end and the geofence reports keep working)
 * while making `segments[]` the single authority.
 *
 * Every write path must call `applyShiftRollups` after touching `segments`, so
 * consistency is structural rather than a matter of discipline.
 */

export interface ShiftSegmentLike {
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  hospitalId?: any;
  startLocation?: { lat?: number; lng?: number } | null;
  endLocation?: { lat?: number; lng?: number } | null;
  startFenceStatus?: string | null;
  startDistanceMeters?: number | null;
  autoClosed?: boolean;
  closeReason?: string | null;
}

const ms = (d: any): number => new Date(d).getTime();
const isOpen = (s: ShiftSegmentLike) => !s?.endTime;

/** Worked minutes for one segment; 0 while it is still open, never negative. */
export function segmentMinutes(seg: ShiftSegmentLike): number {
  if (!seg?.startTime || !seg.endTime) return 0;
  const span = ms(seg.endTime) - ms(seg.startTime);
  if (!Number.isFinite(span)) return 0;
  return Math.max(0, Math.round(span / 60000));
}

/** Sum of every CLOSED segment. The open one contributes only in live views. */
export function workedMinutesOf(segments: ShiftSegmentLike[]): number {
  return (segments ?? []).reduce((total, seg) => total + segmentMinutes(seg), 0);
}

/**
 * Total worked minutes *right now*, including the running segment. Used by the
 * dashboard's live counter and by the cron's max-duration test — both of which
 * must not wait for the day to be closed before they can see the hours.
 */
export function liveWorkedMinutes(
  workedMinutes: number,
  currentSegmentStartedAt?: Date | string | null,
  now: number = Date.now(),
): number {
  const base = Math.max(0, workedMinutes ?? 0);
  if (!currentSegmentStartedAt) return base;
  const started = ms(currentSegmentStartedAt);
  if (!Number.isFinite(started)) return base;
  return base + Math.max(0, Math.round((now - started) / 60000));
}

/** Build a segment for a fresh check-in. */
export function buildSegment(input: {
  startTime: Date;
  hospitalId?: any;
  startLocation?: { lat: number; lng: number };
  startFenceStatus?: string;
  startDistanceMeters?: number;
}): ShiftSegmentLike {
  return {
    startTime: input.startTime,
    hospitalId: input.hospitalId,
    startLocation: input.startLocation,
    startFenceStatus: input.startFenceStatus,
    startDistanceMeters: input.startDistanceMeters,
    autoClosed: false,
  };
}

/** `YYYY-MM-DD` (Riyadh) for the day a shift belongs to. */
export const shiftDayKey = (start: Date | string) => riyadhDayKey(new Date(start));

/**
 * Recompute every derived field from `segments[]`. Mutates and returns the doc
 * (works on both a Mongoose document and a plain object).
 *
 * Segments are sorted by start time first, so a caller that pushed out of order
 * still gets a coherent rollup.
 */
export function applyShiftRollups<T>(input: T): T {
  // Deliberately untyped: this runs on both Mongoose documents and the plain
  // objects the backfill builds, which have no shared TS shape.
  const doc = input as any;

  const segments: ShiftSegmentLike[] = (doc.segments ?? []).slice();
  if (segments.length === 0) return input;

  segments.sort((a, b) => ms(a.startTime) - ms(b.startTime));
  doc.segments = segments;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const open = isOpen(last);

  // Identity of the day: first check-in wins, which is what keeps `earliestByDay`
  // (and therefore punctuality and payroll) identical to the pre-collapse data.
  doc.dayKey = shiftDayKey(first.startTime as Date);
  doc.startTime = first.startTime;
  doc.hospitalId = first.hospitalId;
  doc.startLocation = first.startLocation;
  doc.startFenceStatus = first.startFenceStatus;
  doc.startDistanceMeters = first.startDistanceMeters;

  doc.status = open ? shiftStatus.IN_PROGRESS : shiftStatus.ENDED;
  doc.endTime = open ? undefined : last.endTime;
  doc.currentSegmentStartedAt = open ? last.startTime : undefined;

  // "How did the day finally end" — the last CLOSED segment's outcome.
  const lastClosed = [...segments].reverse().find((s) => !isOpen(s));
  doc.endLocation = lastClosed?.endLocation;
  doc.autoClosed = open ? false : !!lastClosed?.autoClosed;
  doc.closeReason = open ? undefined : lastClosed?.closeReason;

  doc.sessionsCount = segments.length;
  doc.workedMinutes = workedMinutesOf(segments);

  return input;
}
