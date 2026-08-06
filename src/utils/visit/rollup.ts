/* eslint-disable @typescript-eslint/no-explicit-any */
import { shiftStatus } from "@/models/enum.constants";

/**
 * Visit-side mirror of `src/utils/shift/rollup.ts`.
 *
 * A visit can be ended and resumed within the same shift, so its duration must
 * come from the sum of its sessions rather than `endTime - startTime` — the
 * span would swallow the gap and inflate every reopened visit.
 */

export interface VisitSegmentLike {
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  startLocation?: { lat?: number; lng?: number } | null;
  endLocation?: { lat?: number; lng?: number } | null;
  startFenceStatus?: string | null;
  startDistanceMeters?: number | null;
}

const ms = (d: any): number => new Date(d).getTime();

export function visitSegmentMinutes(seg: VisitSegmentLike): number {
  if (!seg?.startTime || !seg.endTime) return 0;
  const span = ms(seg.endTime) - ms(seg.startTime);
  if (!Number.isFinite(span)) return 0;
  return Math.max(0, Math.round(span / 60000));
}

/** Recompute the derived fields from `segments[]`. Mutates and returns the doc. */
export function applyVisitRollups<T>(input: T): T {
  const doc = input as any;
  const segments: VisitSegmentLike[] = (doc.segments ?? []).slice();
  if (segments.length === 0) return input;

  segments.sort((a, b) => ms(a.startTime) - ms(b.startTime));
  doc.segments = segments;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const open = !last.endTime;

  doc.startTime = first.startTime;
  doc.startLocation = first.startLocation;
  // The top-level fence pair is a projection of the FIRST session, matching
  // applyShiftRollups. Callers that synthesise segments[0] from a legacy visit
  // must copy the fence fields across, or this wipes the original verdict.
  doc.startFenceStatus = first.startFenceStatus;
  doc.startDistanceMeters = first.startDistanceMeters;
  doc.status = open ? shiftStatus.IN_PROGRESS : shiftStatus.ENDED;
  doc.endTime = open ? undefined : last.endTime;

  const lastClosed = [...segments].reverse().find((s) => !!s.endTime);
  doc.endLocation = lastClosed?.endLocation;

  doc.sessionsCount = segments.length;
  doc.workedMinutes = segments.reduce((total, s) => total + visitSegmentMinutes(s), 0);

  return input;
}
