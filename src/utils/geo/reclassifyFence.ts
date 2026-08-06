/* eslint-disable @typescript-eslint/no-explicit-any */
import { Shift } from "@/models/Shift";
import { Visit } from "@/models/Visit";
import { fenceStatus } from "@/models/enum.constants";
import { evaluateFence, type LatLng } from "@/utils/geo/geofence";

export interface ReclassifyResult {
  shifts: number;
  visits: number;
}

/**
 * Rebuild the IN_RANGE / OUT_OF_RANGE branch of a stored verdict from the
 * distance that was already persisted at check-in.
 *
 * Only records with a numeric `startDistanceMeters` are touched — that is
 * exactly the set that got a real proximity verdict. NO_LOCATION_FIX and
 * HOSPITAL_NOT_CONFIGURED are stored with no distance, so the else-branch hands
 * back the existing status and leaves them alone (a missing field stays missing:
 * an aggregation `$set` to a missing expression is a no-op).
 *
 * `<=` mirrors `evaluateFence`. Note the stored distance is rounded while the
 * live check compares the raw value, so the two can disagree by under a metre
 * exactly on the boundary.
 */
function verdict(distExpr: string, statusExpr: string, radiusMeters: number) {
  return {
    $cond: [
      { $isNumber: distExpr },
      { $cond: [{ $lte: [distExpr, radiusMeters] }, fenceStatus.IN_RANGE, fenceStatus.OUT_OF_RANGE] },
      statusExpr,
    ],
  };
}

/**
 * Restrict the scan to documents that actually hold a proximity verdict
 * somewhere. Shifts and visits share the shape: a top-level pair plus a
 * per-session copy on `segments[]`.
 */
const RECLASSIFY_FILTER = {
  $or: [
    { startDistanceMeters: { $type: "number" } },
    { "segments.startDistanceMeters": { $type: "number" } },
  ],
};

/**
 * The `$set` stage shared by both collections. Updating the top level without
 * the segments (or vice versa) would leave the badges and the compliance report
 * disagreeing — the report unwinds `segments[]` while the badges read the
 * top-level copy. Each level derives from its own stored distance, which
 * preserves the rollup invariant that the top level mirrors `segments[0]`.
 */
function reclassifyStage(radiusMeters: number) {
  return {
    $set: {
      startFenceStatus: verdict("$startDistanceMeters", "$startFenceStatus", radiusMeters),
      segments: {
        $map: {
          input: { $ifNull: ["$segments", []] },
          as: "s",
          in: {
            $mergeObjects: [
              "$$s",
              {
                startFenceStatus: verdict(
                  "$$s.startDistanceMeters",
                  "$$s.startFenceStatus",
                  radiusMeters,
                ),
              },
            ],
          },
        },
      },
    },
  };
}

/**
 * Reclassify every past check-in against `radiusMeters`.
 *
 * The geofence verdict is frozen into the document at check-in time and every
 * reader (compliance report, visits table, badges) consumes that stored string —
 * so without this, changing the radius would only ever affect future check-ins
 * and the number in Settings would stop describing what the reports show.
 *
 * Idempotent and reversible: distances are never rewritten, only the verdict
 * derived from them, so re-running with the old radius restores the old labels.
 *
 * Two pipeline `updateMany`s, one round trip each. Neither collection is indexed
 * on `startDistanceMeters`, so both are collection scans — acceptable at this
 * app's scale, but move this behind a manually triggered admin route if shifts
 * ever grow into the millions.
 */
export async function reclassifyFenceStatuses(radiusMeters: number): Promise<ReclassifyResult> {
  const stage = [reclassifyStage(radiusMeters)] as any;

  const [shiftRes, visitRes] = await Promise.all([
    Shift.updateMany(RECLASSIFY_FILTER, stage, { timestamps: false }),
    Visit.updateMany(RECLASSIFY_FILTER, stage, { timestamps: false }),
  ]);

  return {
    shifts: shiftRes?.modifiedCount ?? 0,
    visits: visitRes?.modifiedCount ?? 0,
  };
}

/**
 * Stage a status/distance pair onto a document's `$set`/`$unset` accumulators.
 * `prefix` is "" for the top level or `segments.<i>.` for one session.
 *
 * A null distance is unset rather than written as null, so a record that falls
 * back to NO_LOCATION_FIX / HOSPITAL_NOT_CONFIGURED matches the shape the
 * check-in routes leave behind (`default: undefined`) instead of carrying a
 * stale or null number the badge would try to render.
 */
function stageFence(
  set: Record<string, unknown>,
  unset: Record<string, "">,
  prefix: string,
  status: string | null | undefined,
  distance: number | null | undefined,
) {
  const statusKey = `${prefix}startFenceStatus`;
  const distanceKey = `${prefix}startDistanceMeters`;
  if (status == null) unset[statusKey] = "";
  else set[statusKey] = status;
  if (distance == null) unset[distanceKey] = "";
  else set[distanceKey] = distance;
}

/** Collapse the two accumulators into an update doc, or null when nothing changed. */
function buildUpdate(set: Record<string, unknown>, unset: Record<string, "">) {
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  // Mongo rejects an empty $unset, so only attach it when populated.
  if (Object.keys(unset).length) update.$unset = unset;
  return Object.keys(update).length ? update : null;
}

/**
 * Recompute distance AND verdict for every past check-in at one hospital.
 *
 * Moving a hospital's pin invalidates the stored `startDistanceMeters` itself,
 * which `reclassifyFenceStatuses` cannot repair — it only re-derives the verdict
 * from a distance it trusts. So this path re-measures from the device fix that
 * was stored at check-in, reusing `evaluateFence` (the same function the
 * check-in routes call) rather than reimplementing haversine in a pipeline.
 *
 * Unlike the radius path, this one CAN turn HOSPITAL_NOT_CONFIGURED into a real
 * verdict — that is the point when an admin sets coordinates for the first time,
 * and equally it returns records to HOSPITAL_NOT_CONFIGURED if a location is
 * cleared.
 *
 * It will NOT, however, classify a record that never had a verdict. Check-ins
 * that predate geofencing carry no fence fields, and most carry no GPS fix
 * either; re-measuring them would stamp hundreds of legacy rows with
 * NO_LOCATION_FIX and pull them into the compliance report's denominator — and
 * only for whichever hospitals happen to get moved. Scope is therefore the same
 * as the radius path: records the feature itself produced.
 *
 * Runs in JS over a per-hospital slice (small) and writes one unordered
 * bulkWrite per collection. Idempotent: a repeat modifies nothing.
 */
/** True when this level already carries a verdict, i.e. geofencing produced it. */
const hasVerdict = (doc: any) => doc?.startFenceStatus != null;

export async function recomputeHospitalFences(
  hospitalId: string,
  hospitalLoc: LatLng | null | undefined,
  radiusMeters: number,
): Promise<ReclassifyResult> {
  const alreadyClassified = {
    $or: [{ startFenceStatus: { $ne: null } }, { "segments.startFenceStatus": { $ne: null } }],
  };

  const [visitDocs, shiftDocs] = await Promise.all([
    Visit.find({ hospitalId, ...alreadyClassified })
      .select("startLocation startFenceStatus segments.startLocation segments.startFenceStatus")
      .lean(),
    // A day can span hospitals, so a shift qualifies via either its own
    // hospital or any one of its sessions'. `$and` because both clauses are
    // `$or`s — spreading the second would silently overwrite the first and
    // widen the scan to every classified shift in the collection.
    Shift.find({
      $and: [{ $or: [{ hospitalId }, { "segments.hospitalId": hospitalId }] }, alreadyClassified],
    })
      .select(
        "hospitalId startLocation startFenceStatus segments.hospitalId segments.startLocation " +
          "segments.startFenceStatus segments.startDistanceMeters",
      )
      .lean(),
  ]);

  // Visits are single-hospital by construction, so every session belongs to the
  // hospital that moved. The top level is recomputed from its own stored fix,
  // which the rollup keeps identical to segments[0]'s.
  const visitOps: any[] = [];
  for (const v of visitDocs as any[]) {
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};

    if (hasVerdict(v)) {
      const top = evaluateFence(v.startLocation, hospitalLoc, radiusMeters);
      stageFence(set, unset, "", top.status, top.distanceMeters);
    }

    ((v.segments ?? []) as any[]).forEach((seg, i) => {
      if (!hasVerdict(seg)) return;
      const f = evaluateFence(seg.startLocation, hospitalLoc, radiusMeters);
      stageFence(set, unset, `segments.${i}.`, f.status, f.distanceMeters);
    });

    const update = buildUpdate(set, unset);
    if (update) visitOps.push({ updateOne: { filter: { _id: v._id }, update } });
  }

  const shiftOps: any[] = [];
  for (const s of shiftDocs as any[]) {
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    const segments = (s.segments ?? []) as any[];

    // Only the sessions at THIS hospital are re-measured; a session recorded
    // elsewhere in the same day must keep its own verdict.
    segments.forEach((seg, i) => {
      if (String(seg.hospitalId ?? "") !== hospitalId || !hasVerdict(seg)) return;
      const f = evaluateFence(seg.startLocation, hospitalLoc, radiusMeters);
      seg.startFenceStatus = f.status;
      seg.startDistanceMeters = f.distanceMeters;
      stageFence(set, unset, `segments.${i}.`, f.status, f.distanceMeters);
    });

    if (segments.length > 0) {
      // The top level mirrors segments[0] (applyShiftRollups). Touch it only when
      // that first session actually moved — otherwise this hospital's edit would
      // rewrite a projection of a session belonging to a different hospital.
      if (String(segments[0].hospitalId ?? "") === hospitalId && hasVerdict(segments[0])) {
        stageFence(set, unset, "", segments[0].startFenceStatus, segments[0].startDistanceMeters);
      }
    } else if (String(s.hospitalId ?? "") === hospitalId && hasVerdict(s)) {
      // Legacy shift with no sessions: the top level is the only record there is.
      const f = evaluateFence(s.startLocation, hospitalLoc, radiusMeters);
      stageFence(set, unset, "", f.status, f.distanceMeters);
    }

    const update = buildUpdate(set, unset);
    if (update) shiftOps.push({ updateOne: { filter: { _id: s._id }, update } });
  }

  const [visitRes, shiftRes] = await Promise.all([
    visitOps.length ? Visit.bulkWrite(visitOps, { ordered: false, timestamps: false } as any) : null,
    shiftOps.length ? Shift.bulkWrite(shiftOps, { ordered: false, timestamps: false } as any) : null,
  ]);

  return {
    shifts: shiftRes?.modifiedCount ?? 0,
    visits: visitRes?.modifiedCount ?? 0,
  };
}
