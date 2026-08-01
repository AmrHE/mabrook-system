/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Shift } from "@/models/Shift";
import { Visit } from "@/models/Visit";
import { User } from "@/models/User";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { riyadhDayKey } from "@/utils/date/range";
import { applyShiftRollups, segmentMinutes } from "@/utils/shift/rollup";
import { effectiveActivityMs, loadActivitySignals } from "@/utils/shift/lastActivity";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ms = (d: any) => new Date(d).getTime();
const BATCH = 500;

/**
 * POST /api/shift/backfill-day-shifts                  — DRY RUN (reports only)
 * POST /api/shift/backfill-day-shifts?apply=true       — writes
 * POST /api/shift/backfill-day-shifts?createIndex=true — builds the unique index
 *
 * Collapses the historical shift collection to one document per employee per
 * Riyadh day. Every absorbed shift becomes one SEGMENT of the survivor, so no
 * check-in, GPS fix or geofence verdict is lost — `segments.length` equals the
 * number of documents merged, which makes the result trivially verifiable.
 *
 * Optional scoping so the run can be piloted before it is trusted:
 *   ?userId=  one employee   ?from= / ?to=  a date window (ISO)
 *   ?maxGroups=  stop after N day-groups (resume by re-running)
 *
 * Runbook:
 *   0. Back up `shifts`, `visits`, `users` via /api/backup/collection
 *   1. Dry run  -> review hoursBefore/hoursAfter, attendedDays, earliestArrivalChanged
 *   2. ?apply=true on one user, then one month, then everything
 *   3. ?createIndex=true once indexReady reports zeroes
 *   4. Re-run the dry run and confirm daysWithMultipleShifts === 0
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  await initDb();

  const sp = req.nextUrl.searchParams;
  const apply = sp.get("apply") === "true";
  const createIndex = sp.get("createIndex") === "true";
  const userIdParam = sp.get("userId");
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const maxGroups = Number(sp.get("maxGroups")) || Infinity;

  const filter: any = {};
  if (userIdParam && mongoose.isValidObjectId(userIdParam)) {
    filter.userId = new mongoose.Types.ObjectId(userIdParam);
  }
  if (fromParam || toParam) {
    filter.startTime = {};
    if (fromParam) filter.startTime.$gte = new Date(fromParam);
    if (toParam) filter.startTime.$lt = new Date(toParam);
  }

  if (createIndex) return handleCreateIndex();

  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = riyadhDayKey(now);

  const report: any = {
    ok: true,
    ranAt: now.toISOString(),
    apply,
    scope: { userId: userIdParam ?? null, from: fromParam ?? null, to: toParam ?? null },
    pass1: { scanned: 0, stamped: 0, alreadyStamped: 0 },
    pass2: {
      daysTotal: 0,
      daysWithMultipleShifts: 0,
      shiftsAbsorbed: 0,
      segmentsAfterMerge: 0,
      visitsRepointed: 0,
      overlappingPairs: 0,
      openShiftsInPast: 0,
      groupsProcessed: 0,
      truncated: false,
    },
    shiftsPerDayHistogram: {} as Record<string, number>,
    validation: {
      hoursBefore: 0,
      hoursAfter: 0,
      hoursDeltaTopUsers: [] as any[],
      attendedDaysBefore: 0,
      attendedDaysAfter: 0,
      earliestArrivalChanged: [] as any[],
    },
    anomalies: [] as any[],
    indexReady: { missingDayKey: 0, duplicateUserDay: 0 },
    sampleGroups: [] as any[],
  };

  /* ------------------------------------------------------------------ *
   * PASS 1 — stamp dayKey + segments on every shift.
   *
   * Non-destructive and idempotent: no merging happens here, so the app keeps
   * working correctly even if pass 2 is interrupted halfway.
   * ------------------------------------------------------------------ */
  {
    const cursor = Shift.find(filter).sort({ userId: 1, startTime: 1 }).cursor();
    let ops: any[] = [];

    for await (const doc of cursor) {
      report.pass1.scanned++;

      // Guard against a re-run recomputing workedMinutes from the SPAN of an
      // already-merged document, which would silently re-introduce the gaps.
      if (doc.segments?.length) {
        report.pass1.alreadyStamped++;
        continue;
      }

      const start = doc.startTime ?? doc.createdAt;
      if (!start || !Number.isFinite(ms(start))) {
        // Never guess: a fabricated start would land on today's dayKey and
        // collide with the employee's live shift.
        report.anomalies.push({ shiftId: String(doc._id), issue: "missing or invalid startTime" });
        continue;
      }
      if (doc.endTime && ms(doc.endTime) < ms(start)) {
        report.anomalies.push({ shiftId: String(doc._id), issue: "endTime before startTime" });
      }
      if (doc.endTime && ms(doc.endTime) > nowMs) {
        report.anomalies.push({ shiftId: String(doc._id), issue: "endTime in the future" });
      }

      const segment = {
        startTime: start,
        endTime: doc.endTime,
        hospitalId: doc.hospitalId,
        startLocation: doc.startLocation,
        endLocation: doc.endLocation,
        startFenceStatus: doc.startFenceStatus,
        startDistanceMeters: doc.startDistanceMeters,
        autoClosed: !!doc.autoClosed,
        closeReason: doc.closeReason,
      };

      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              dayKey: riyadhDayKey(new Date(start)),
              segments: [segment],
              sessionsCount: 1,
              workedMinutes: segmentMinutes(segment),
              currentSegmentStartedAt: segment.endTime ? undefined : start,
            },
          },
        },
      });
      report.pass1.stamped++;

      if (apply && ops.length >= BATCH) {
        await Shift.bulkWrite(ops);
        ops = [];
      }
    }
    if (apply && ops.length) await Shift.bulkWrite(ops);
  }

  /* ------------------------------------------------------------------ *
   * PASS 2 — merge per (userId, dayKey).
   * ------------------------------------------------------------------ */

  // dayKey is only persisted when applying, so a dry run has to derive it.
  const dayKeyExpr = {
    $ifNull: [
      "$dayKey",
      { $dateToString: { date: "$startTime", format: "%Y-%m-%d", timezone: "Asia/Riyadh" } },
    ],
  };

  const groups: any[] = await Shift.aggregate([
    { $match: filter },
    { $addFields: { _dayKey: dayKeyExpr } },
    {
      $group: {
        _id: { u: "$userId", d: "$_dayKey" },
        ids: { $push: "$_id" },
        n: { $sum: 1 },
        earliest: { $min: "$startTime" },
        hours: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", shiftStatus.ENDED] }, { $ne: ["$endTime", null] }] },
              { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 3600000] },
              0,
            ],
          },
        },
      },
    },
  ]);

  report.pass2.daysTotal = groups.length;
  report.validation.attendedDaysBefore = groups.length;
  for (const g of groups) {
    const bucket = g.n >= 4 ? "4+" : String(g.n);
    report.shiftsPerDayHistogram[bucket] = (report.shiftsPerDayHistogram[bucket] ?? 0) + 1;
    report.validation.hoursBefore += g.hours;
  }

  const multi = groups.filter((g) => g.n > 1);
  report.pass2.daysWithMultipleShifts = multi.length;

  const deltaByUser = new Map<string, number>();

  for (const group of multi) {
    if (report.pass2.groupsProcessed >= maxGroups) {
      report.pass2.truncated = true;
      break;
    }
    report.pass2.groupsProcessed++;

    const docs: any[] = await Shift.find({ _id: { $in: group.ids } }).sort({ startTime: 1 });
    if (docs.length < 2) continue;

    // EARLIEST wins. That is what preserves the day's first arrival — and with
    // it `earliestByDay`, punctuality and the salary report.
    const survivor = docs[0];
    const absorbed = docs.slice(1);
    const absorbedIds = absorbed.map((d) => d._id);

    const { visitMax, momMax } = await loadActivitySignals(group.ids);

    const hoursBefore = docs.reduce(
      (sum, d) =>
        sum +
        (d.status === shiftStatus.ENDED && d.endTime
          ? (ms(d.endTime) - ms(d.startTime)) / 3600000
          : 0),
      0,
    );

    // Flatten every document's segments (pass 1 gave each exactly one).
    const all: any[] = docs
      .flatMap((d) =>
        (d.segments?.length ? d.segments : [{ startTime: d.startTime, endTime: d.endTime, hospitalId: d.hospitalId, startLocation: d.startLocation, endLocation: d.endLocation, startFenceStatus: d.startFenceStatus, startDistanceMeters: d.startDistanceMeters, autoClosed: !!d.autoClosed, closeReason: d.closeReason }]).map(
          (s: any) => ({ seg: s, ownerId: String(d._id), owner: d }),
        ),
      )
      .sort((a, b) => ms(a.seg.startTime) - ms(b.seg.startTime));

    // Merge overlaps. The duplicate bug produced genuinely concurrent shifts,
    // and summing them would double-count the same hour. Keep the FIRST
    // segment's check-in metadata — that is the real arrival.
    const merged: any[] = [];
    for (const { seg, ownerId, owner } of all) {
      const last = merged[merged.length - 1];
      const lastEnd = last ? (last.seg.endTime ? ms(last.seg.endTime) : nowMs) : -Infinity;

      if (last && ms(seg.startTime) <= lastEnd) {
        const a = last.seg.endTime ? ms(last.seg.endTime) : null;
        const b = seg.endTime ? ms(seg.endTime) : null;
        last.seg.endTime = a === null || b === null ? null : new Date(Math.max(a, b));
        last.mergedFrom = (last.mergedFrom ?? 1) + 1;
        report.pass2.overlappingPairs++;
      } else {
        merged.push({ seg: { ...(seg.toObject?.() ?? seg) }, ownerId, owner });
      }
    }

    // At most one segment may remain open, and only the last one.
    for (let i = 0; i < merged.length; i++) {
      const { seg, ownerId, owner } = merged[i];
      const isLast = i === merged.length - 1;
      if (seg.endTime) continue;

      const openStartMs = ms(seg.startTime);
      const endMs = effectiveActivityMs({
        openStartMs,
        lastActivityAt: owner.lastActivityAt,
        visitMax: visitMax.get(ownerId),
        momMax: momMax.get(ownerId),
        nowMs: isLast ? nowMs : ms(merged[i + 1].seg.startTime),
      });

      if (!isLast) {
        seg.endTime = new Date(endMs);
        seg.autoClosed = true;
        seg.closeReason = shiftCloseReason.DUPLICATE;
      } else if (group._id.d < todayKey) {
        // An open shift from a past day is a forgot-to-end, not live work.
        seg.endTime = new Date(endMs);
        seg.autoClosed = true;
        seg.closeReason = shiftCloseReason.INACTIVITY;
        report.pass2.openShiftsInPast++;
      }
    }

    survivor.segments = merged.map((m) => m.seg);
    applyShiftRollups(survivor); // the SAME helper the runtime uses

    const hoursAfter = (survivor.workedMinutes ?? 0) / 60;
    const uid = String(group._id.u);
    deltaByUser.set(uid, (deltaByUser.get(uid) ?? 0) + (hoursAfter - hoursBefore));

    report.pass2.shiftsAbsorbed += absorbed.length;
    report.pass2.segmentsAfterMerge += merged.length;

    if (ms(survivor.startTime) !== ms(group.earliest)) {
      report.validation.earliestArrivalChanged.push({
        userId: uid,
        dayKey: group._id.d,
        was: new Date(group.earliest).toISOString(),
        now: new Date(survivor.startTime).toISOString(),
      });
    }

    if (report.sampleGroups.length < 50) {
      report.sampleGroups.push({
        userId: uid,
        dayKey: group._id.d,
        before: docs.map((d) => ({
          id: String(d._id),
          start: d.startTime,
          end: d.endTime,
          status: d.status,
        })),
        after: {
          id: String(survivor._id),
          sessions: survivor.sessionsCount,
          workedMinutes: survivor.workedMinutes,
          start: survivor.startTime,
          end: survivor.endTime,
        },
        hoursBefore: Math.round(hoursBefore * 100) / 100,
        hoursAfter: Math.round(hoursAfter * 100) / 100,
      });
    }

    const visitsToRepoint = await Visit.countDocuments({ shiftId: { $in: absorbedIds } });
    report.pass2.visitsRepointed += visitsToRepoint;

    if (apply) {
      // Per group, never the whole run: a single transaction over a year of
      // data would blow the oplog and the 60s limit.
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await survivor.save({ session });
          await Visit.updateMany(
            { shiftId: { $in: absorbedIds } },
            { $set: { shiftId: survivor._id } },
            { session },
          );
          // $pull and $addToSet on the same array in one update is illegal.
          await User.updateOne(
            { _id: group._id.u },
            { $pull: { shifts: { $in: absorbedIds } } },
            { session },
          );
          await User.updateOne(
            { _id: group._id.u },
            { $addToSet: { shifts: survivor._id } },
            { session },
          );
          await Shift.deleteMany({ _id: { $in: absorbedIds } }, { session });
        });
      } finally {
        await session.endSession();
      }
    }
  }

  report.validation.hoursAfter =
    report.validation.hoursBefore +
    [...deltaByUser.values()].reduce((a, b) => a + b, 0);
  report.validation.attendedDaysAfter = groups.length; // merging never removes a day
  report.validation.hoursDeltaTopUsers = [...deltaByUser.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 20)
    .map(([userId, delta]) => ({ userId, deltaHours: Math.round(delta * 100) / 100 }));

  for (const key of ["hoursBefore", "hoursAfter"] as const) {
    report.validation[key] = Math.round(report.validation[key] * 100) / 100;
  }

  report.indexReady = await indexReadiness();

  return NextResponse.json(report, { status: 200 });
}

/** Counters that must both be 0 before the unique index can be built. */
async function indexReadiness() {
  const missingDayKey = await Shift.countDocuments({
    $or: [{ dayKey: { $exists: false } }, { dayKey: null }],
  });
  const dupes = await Shift.aggregate([
    { $match: { dayKey: { $type: "string" } } },
    { $group: { _id: { u: "$userId", d: "$dayKey" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "total" },
  ]);
  return { missingDayKey, duplicateUserDay: dupes[0]?.total ?? 0 };
}

async function handleCreateIndex() {
  const readiness = await indexReadiness();
  if (readiness.missingDayKey > 0 || readiness.duplicateUserDay > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Refusing to build the unique index: run the collapse first.",
        indexReady: readiness,
      },
      { status: 409 },
    );
  }

  await Shift.collection.createIndex(
    { userId: 1, dayKey: 1 },
    { unique: true, background: true, partialFilterExpression: { dayKey: { $type: "string" } } },
  );

  return NextResponse.json({ ok: true, indexReady: readiness, created: true }, { status: 200 });
}
