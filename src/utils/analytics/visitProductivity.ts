/**
 * Low-productivity visit flag: is a visit's moms-per-hour far below what the
 * team actually manages?
 *
 * SERVER-ONLY (hits Mongo + Settings).
 *
 * This module is the feature's entire consistency contract. Every surface —
 * the admin analytics pipelines *and* the non-admin `/api/visit/get-visits` —
 * must get its cutoff from here and nowhere else, otherwise the same visit
 * reads "flagged" on one page and "fine" on another.
 *
 * ## The baseline is deliberately NOT range-bound
 *
 * `/visits` and the employee detail tab have no date filter at all, so a
 * range-derived baseline is undefined there. Worse, a baseline computed over
 * whatever range is selected collapses on itself: narrow to a single day and
 * the baseline becomes that day's average, so you always flag roughly the
 * bottom half of whatever you happen to be looking at. Instead the baseline is
 * a pooled rate over a rolling window ending now. A page's date range decides
 * which visits are *listed*; it never moves the cutoff.
 *
 * Consequence: the flag is not stable over time (the window rolls), so it must
 * never be persisted on the Visit document — always compute it at read time.
 *
 * ## Pooled, not mean-of-ratios
 *
 * `Σ moms / Σ hours`, not `mean(moms_i / hours_i)`. Mean-of-ratios is dominated
 * by short visits — a 12-minute visit with 2 moms scores 10/h and yanks the
 * average up. Pooled is the team's real throughput, and matches how
 * `momsPerHour` is already computed in employees-report.
 *
 * ## Duration comes from segments, not the span
 *
 * A visit can be ended and resumed within a shift, so `endTime - startTime`
 * would swallow the gap and make every reopened visit look unproductive. The
 * canonical figure is `workedMinutes` (sum of the closed segments, maintained by
 * utils/visit/rollup.ts). Legacy rows predate segments and fall back to the span.
 *
 * ## Mom counting
 *
 * Uses `$size: $moms`, like visits-rows, shifts-detail, the عدد الأمهات column
 * and the visitsWithZeroMoms check. Soft-deleting a mom does NOT `$pull` it out
 * of `Visit.moms`, so this over-counts slightly — which raises the numerator and
 * makes a visit LESS likely to be flagged. False-negative bias is the right
 * direction for an accusatory flag, and a flag whose arithmetic disagreed with
 * the mom count printed in the same row would be unexplainable.
 */
import { Visit } from "@/models/Visit";
import { shiftStatus } from "@/models/enum.constants";
import { initDb } from "@/lib/mongoose";
import { getSettings } from "@/utils/settings/getSettings";
import { excludeUsers, getExcludedUserIds } from "@/utils/analytics/excludedUsers";

/**
 * Below this many qualifying visits the baseline is statistical noise and the
 * flag switches itself off. A module constant rather than a setting: it is a
 * correctness guard, not an operational preference, and exposing it would
 * invite someone to set it to 1.
 */
export const MIN_BASELINE_VISITS = 20;

/**
 * Visits longer than this are excluded from both the baseline and the flag. A
 * visit "ended" days later has a near-zero rate and would always flag — but the
 * real defect there is *forgot to end the visit*, not productivity. Also absorbs
 * clock skew.
 */
export const MAX_VISIT_HOURS = 24;

/** Floor on the configurable minimum duration, so a bad setting can't make the divisor zero. */
const MIN_HOURS_FLOOR = 0.25;

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface MomRateBaseline {
  /** Pooled Σmoms/Σhours across the window. 0 when `ready` is false. */
  teamAvgMomsPerHour: number;
  /** teamAvg × ratio, rounded to 2dp. 0 when `ready` is false. */
  thresholdMomsPerHour: number;
  /** Shortest visit that gets judged (hours), clamped to >= MIN_HOURS_FLOOR. */
  minHours: number;
  /** The configured fraction of the team average, as 0–1. */
  ratio: number;
  /** How many visits went into the average. */
  baselineVisits: number;
  /** Width of the rolling window in days. */
  baselineDays: number;
  /** False => nothing is ever flagged, anywhere. */
  ready: boolean;
}

/** The subset of a Visit doc the pure helpers need. */
export interface VisitLike {
  status?: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  moms?: unknown[] | null;
  /** Sum of the visit's sessions; absent on rows that predate visit resume. */
  workedMinutes?: number | null;
}

const NOT_READY: MomRateBaseline = {
  teamAvgMomsPerHour: 0,
  thresholdMomsPerHour: 0,
  minHours: MIN_HOURS_FLOOR,
  ratio: 0,
  baselineVisits: 0,
  baselineDays: 0,
  ready: false,
};

/* ------------------------------------------------------------------ *
 * Cache
 *
 * `getSettings()` is deliberately uncached so admin edits apply immediately;
 * the expensive part here is the aggregation, so that is what gets memoised —
 * keyed on the settings that change its result, and dropped outright by the
 * settings PUT handler.
 * ------------------------------------------------------------------ */

let cached: MomRateBaseline | null = null;
let cachedAt = 0;
let cachedKey = "";

export function invalidateMomRateBaseline(): void {
  cached = null;
  cachedAt = 0;
  cachedKey = "";
}

/**
 * The canonical baseline. Every surface calls this; nothing else may derive a
 * cutoff. Memoised for {@link CACHE_TTL_MS} — without it, loading `/visits`
 * would fire a collection-wide aggregation on a page that never touched
 * analytics before, and the admin home's ~10 parallel requests would each want
 * one. On serverless the memo is per-instance, so two surfaces can briefly hold
 * baselines seconds apart; `thresholdMomsPerHour` is rounded to 2dp so
 * razor-edge comparisons still agree.
 */
export async function getMomRateBaseline(): Promise<MomRateBaseline> {
  const settings = await getSettings();

  const ratio = (settings.lowMomRateRatioPercent ?? 50) / 100;
  const minHours = Math.max(MIN_HOURS_FLOOR, (settings.lowMomRateMinVisitMinutes ?? 45) / 60);
  const baselineDays = settings.lowMomRateBaselineDays ?? 90;

  const key = `${ratio}|${minHours}|${baselineDays}`;
  const now = Date.now();
  if (cached && cachedKey === key && now - cachedAt < CACHE_TTL_MS) return cached;

  await initDb();

  const windowTo = new Date(now);
  const windowFrom = new Date(now - baselineDays * 86400000);
  const excludedIds = await getExcludedUserIds();

  const agg = await Visit.aggregate([
    {
      $match: {
        // Never filter on deletedAt — it defaults to Date.now() on every doc.
        isActive: true,
        status: shiftStatus.ENDED,
        endTime: { $ne: null },
        startTime: { $ne: null },
        createdAt: { $gte: windowFrom, $lt: windowTo },
        ...excludeUsers("createdBy", excludedIds),
      },
    },
    {
      $project: {
        durH: visitDurHExpr(),
        momsCount: { $size: { $ifNull: ["$moms", []] } },
      },
    },
    // Same population the flag scores: judge like for like. Zero-mom visits stay
    // in — they are real unproductive hours, and dropping them would inflate the
    // average and make the flag harsher.
    { $match: { durH: { $gte: minHours, $lte: MAX_VISIT_HOURS } } },
    {
      $group: {
        _id: null,
        moms: { $sum: "$momsCount" },
        hours: { $sum: "$durH" },
        visits: { $sum: 1 },
      },
    },
  ]);

  const row = agg[0] as { moms?: number; hours?: number; visits?: number } | undefined;
  const visits = row?.visits ?? 0;
  const hours = row?.hours ?? 0;
  const teamAvg = hours > 0 ? (row?.moms ?? 0) / hours : 0;

  const baseline: MomRateBaseline =
    visits < MIN_BASELINE_VISITS || teamAvg <= 0
      ? { ...NOT_READY, minHours, ratio, baselineVisits: visits, baselineDays }
      : {
          teamAvgMomsPerHour: Math.round(teamAvg * 100) / 100,
          thresholdMomsPerHour: Math.round(teamAvg * ratio * 100) / 100,
          minHours,
          ratio,
          baselineVisits: visits,
          baselineDays,
          ready: true,
        };

  cached = baseline;
  cachedAt = now;
  cachedKey = key;
  return baseline;
}

/* ------------------------------------------------------------------ *
 * Pure helpers — for routes/pages that already hold hydrated visit docs
 * ------------------------------------------------------------------ */

const ms = (d?: Date | string | null): number | null => {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Worked hours for a visit.
 *
 * Prefers the summed sessions over the raw span: a visit that was ended and
 * resumed has a span covering the gap, which would understate its rate and
 * flag a perfectly productive employee. Rows written before visit resume have
 * no `workedMinutes` and fall back to the span, which for them is the same thing.
 */
function durationHoursOf(visit: VisitLike): number | null {
  if (typeof visit?.workedMinutes === "number" && visit.workedMinutes > 0) {
    return visit.workedMinutes / 60;
  }
  const start = ms(visit?.startTime);
  const end = ms(visit?.endTime);
  if (start === null || end === null) return null;
  return (end - start) / 3600000;
}

/** Duration in hours (1dp), or null when the visit isn't a completed, sane one. */
export function visitDurationHours(visit: VisitLike): number | null {
  if (visit?.status !== shiftStatus.ENDED) return null;
  const durH = durationHoursOf(visit);
  if (durH === null || durH <= 0 || durH > MAX_VISIT_HOURS) return null;
  return Math.round(durH * 10) / 10;
}

/** Moms per hour (1dp), or null when the visit isn't measurable. */
export function visitMomsPerHour(visit: VisitLike): number | null {
  if (visit?.status !== shiftStatus.ENDED) return null;
  const durH = durationHoursOf(visit);
  if (durH === null || durH <= 0 || durH > MAX_VISIT_HOURS) return null;
  return Math.round(((visit.moms?.length ?? 0) / durH) * 10) / 10;
}

/**
 * The flag itself. Mirrors {@link lowMomRateExpr} exactly — if you change one,
 * change both, or the non-admin pages will disagree with the analytics counts.
 */
export function isLowMomRateVisit(visit: VisitLike, b: MomRateBaseline): boolean {
  if (!b.ready) return false;
  if (visit?.status !== shiftStatus.ENDED) return false;

  const durH = durationHoursOf(visit);
  if (durH === null || durH < b.minHours || durH > MAX_VISIT_HOURS) return false;

  const momsCount = visit.moms?.length ?? 0;
  // Zero-mom visits belong to the visitsWithZeroMoms flag, not this one.
  if (momsCount <= 0) return false;

  return momsCount / durH < b.thresholdMomsPerHour;
}

/* ------------------------------------------------------------------ *
 * Aggregation building blocks
 * ------------------------------------------------------------------ */

/**
 * Worked hours as an aggregation expression — the pipeline twin of
 * {@link durationHoursOf}. Prefers the summed sessions so a resumed visit is
 * not charged for the gap; falls back to the span for rows written before
 * visit resume existed.
 *
 * `root` prefixes the field paths: `"$"` for a top-level document, `"$$v."`
 * inside a `$filter` over an array of visits.
 */
export function visitDurHExpr(root = "$"): Record<string, unknown> {
  const f = (field: string) => `${root}${field}`;
  return {
    $cond: [
      { $gt: [{ $ifNull: [f("workedMinutes"), 0] }, 0] },
      { $divide: [f("workedMinutes"), 60] },
      { $divide: [{ $subtract: [f("endTime"), f("startTime")] }, 3600000] },
    ],
  };
}

/**
 * The flag as an aggregation expression.
 *
 * `root` prefixes the field paths: `"$"` for a top-level document, `"$$v."`
 * when evaluating inside a `$filter` over an array of visits (as
 * employees-report does over its `rangeVisits` lookup).
 *
 * The `$and` clause order is load-bearing: `$and` short-circuits left to right,
 * so `$divide` is only reached once `durH >= minHours` (>= 0.25) has passed.
 * Do not reorder.
 */
export function lowMomRateExpr(b: MomRateBaseline, root = "$"): Record<string, unknown> {
  if (!b.ready) return { $literal: false };

  const f = (field: string) => `${root}${field}`;

  return {
    $let: {
      vars: {
        durH: visitDurHExpr(root),
        momsCount: { $size: { $ifNull: [f("moms"), []] } },
      },
      in: {
        $and: [
          { $eq: [f("isActive"), true] },
          { $eq: [f("status"), shiftStatus.ENDED] },
          { $ne: [f("endTime"), null] },
          { $ne: [f("startTime"), null] },
          { $gte: ["$$durH", b.minHours] },
          { $lte: ["$$durH", MAX_VISIT_HOURS] },
          { $gt: ["$$momsCount", 0] },
          { $lt: [{ $divide: ["$$momsCount", "$$durH"] }, b.thresholdMomsPerHour] },
        ],
      },
    },
  };
}

/**
 * The complete query filter for flagged visits, used VERBATIM by both
 * `countDocuments()` in the data-quality count route and `{ $match: … }` in its
 * rows route. Those two are required to agree exactly; sharing this function is
 * what enforces it, so neither route should ever inline the filter itself.
 *
 * The cheap clauses stay as plain top-level fields rather than being folded into
 * the `$expr` — `$expr` cannot use an index, so the index-eligible predicates
 * must sit outside it.
 *
 * @param extra e.g. `{ createdAt: inRange, ...excludeUsers("createdBy", ids) }`
 */
export function lowMomRateFilter(
  b: MomRateBaseline,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  // Guaranteed-empty and planner-optimised, so callers need no `ready` branch.
  if (!b.ready) return { _id: { $in: [] } };

  return {
    isActive: true,
    status: shiftStatus.ENDED,
    endTime: { $ne: null },
    ...extra,
    $expr: lowMomRateExpr(b),
  };
}
