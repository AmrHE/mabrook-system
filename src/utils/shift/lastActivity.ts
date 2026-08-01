/* eslint-disable @typescript-eslint/no-explicit-any */
import { Visit } from "@/models/Visit";
import { Mom } from "@/models/Mom";

/**
 * Reconstruct "when did this employee last actually do something" per shift.
 *
 * `Shift.lastActivityAt` is bumped on every visit/mom creation, but shifts that
 * predate that field have nothing on them — so the visit and mom timestamps are
 * used as fallback signals. Shared by the auto-close cron and the day-collapse
 * backfill, which must agree on the close instant or the backfill would rewrite
 * hours the cron had already decided.
 */

export interface ActivitySignals {
  /** shiftId → newest visit createdAt (epoch ms). */
  visitMax: Map<string, number>;
  /** shiftId → newest mom createdAt (epoch ms), joined through the visit. */
  momMax: Map<string, number>;
}

const ms = (d: any) => new Date(d).getTime();

export async function loadActivitySignals(shiftIds: any[]): Promise<ActivitySignals> {
  if (!shiftIds.length) return { visitMax: new Map(), momMax: new Map() };

  const [visitAgg, momAgg] = await Promise.all([
    Visit.aggregate([
      { $match: { shiftId: { $in: shiftIds } } },
      { $group: { _id: "$shiftId", max: { $max: "$createdAt" } } },
    ]),
    Mom.aggregate([
      { $lookup: { from: "visits", localField: "visitId", foreignField: "_id", as: "v" } },
      { $unwind: "$v" },
      { $match: { "v.shiftId": { $in: shiftIds } } },
      { $group: { _id: "$v.shiftId", max: { $max: "$createdAt" } } },
    ]),
  ]);

  return {
    visitMax: new Map(visitAgg.map((r: any) => [String(r._id), ms(r.max)])),
    momMax: new Map(momAgg.map((r: any) => [String(r._id), ms(r.max)])),
  };
}

/**
 * Effective last activity for the CURRENTLY OPEN segment, clamped into
 * `[openStartMs, nowMs]`.
 *
 * Clamping to `openStartMs` (rather than the shift's start) is what makes this
 * correct after a resume: any visit or mom timestamp from an earlier session of
 * the same day is necessarily below the current segment's start, so the clamp
 * discards it automatically. Without that, a visit logged in the morning would
 * keep an evening session looking "active" and inactivity would never fire.
 */
export function effectiveActivityMs(args: {
  openStartMs: number;
  lastActivityAt?: Date | string | null;
  visitMax?: number;
  momMax?: number;
  nowMs: number;
}): number {
  const { openStartMs, lastActivityAt, visitMax = 0, momMax = 0, nowMs } = args;
  const signals = [
    openStartMs,
    lastActivityAt ? ms(lastActivityAt) : 0,
    visitMax,
    momMax,
  ].filter((n) => Number.isFinite(n));

  let effective = Math.max(...signals);
  if (effective < openStartMs) effective = openStartMs;
  if (effective > nowMs) effective = nowMs;
  return effective;
}
