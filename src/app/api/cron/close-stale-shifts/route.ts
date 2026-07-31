/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Shift } from "@/models/Shift";
import { Visit } from "@/models/Visit";
import { Mom } from "@/models/Mom";
import { User } from "@/models/User";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { getSettings } from "@/utils/settings/getSettings";

export const dynamic = "force-dynamic";

/** Constant-time secret comparison (false on any length/type mismatch). */
function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const ms = (d: any) => new Date(d).getTime();

/**
 * Auto-close forgotten shifts. Triggered by an external scheduler (cron-job.org)
 * with the `X-Cron-Secret` header. Idempotent and safe to run frequently.
 *
 * Closes a shift when EITHER it exceeds `maxShiftHours` OR it has been idle for
 * `inactivityMinutes`. `endTime` is always set to the last real activity so idle
 * time never counts as worked hours. Also collapses duplicate open shifts per user.
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("X-Cron-Secret"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const { maxShiftHours, inactivityMinutes } = await getSettings();
  const now = new Date();
  const maxCutoffMs = maxShiftHours * 3600000;
  const idleCutoffMs = inactivityMinutes * 60000;

  const open: any[] = await Shift.find({ status: shiftStatus.IN_PROGRESS }).lean();

  const summary = {
    ok: true,
    ranAt: now.toISOString(),
    thresholds: { maxShiftHours, inactivityMinutes },
    scannedOpen: open.length,
    closed: 0,
    visitsClosed: 0,
    byReason: {
      [shiftCloseReason.MAX_DURATION]: 0,
      [shiftCloseReason.INACTIVITY]: 0,
      [shiftCloseReason.DUPLICATE]: 0,
    } as Record<string, number>,
    usersAffected: 0,
    usersStillOnShift: 0,
    dataIssues: 0,
    dryRun,
  };

  // Don't early-return when no shifts are open: the visit sweep below still
  // needs to run so orphaned open visits get closed even during off-hours.
  const shiftIds = open.map((s) => s._id);

  // Fallback last-activity signals for legacy shifts that predate `lastActivityAt`.
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
  const visitMax = new Map<string, number>(visitAgg.map((r: any) => [String(r._id), ms(r.max)]));
  const momMax = new Map<string, number>(momAgg.map((r: any) => [String(r._id), ms(r.max)]));

  // Compute per-shift startTime + effective last activity (clamped to [startTime, now]).
  const nowMs = now.getTime();
  const enriched = open.map((s) => {
    let startMs = s.startTime ? ms(s.startTime) : s.createdAt ? ms(s.createdAt) : nowMs;
    if (!Number.isFinite(startMs)) {
      startMs = nowMs;
      summary.dataIssues++;
    }
    const sid = String(s._id);
    const signals = [
      startMs,
      s.lastActivityAt ? ms(s.lastActivityAt) : 0,
      visitMax.get(sid) ?? 0,
      momMax.get(sid) ?? 0,
    ].filter((n) => Number.isFinite(n));
    let effective = Math.max(...signals);
    if (effective < startMs) effective = startMs;
    if (effective > nowMs) effective = nowMs;
    return { shift: s, startMs, effective };
  });

  // Group by user; a user may hold multiple open shifts.
  const byUser = new Map<string, typeof enriched>();
  for (const e of enriched) {
    const uid = String(e.shift.userId);
    (byUser.get(uid) ?? byUser.set(uid, []).get(uid)!).push(e);
  }

  type CloseOp = { _id: any; endTime: Date; reason: shiftCloseReason };
  const closes: CloseOp[] = [];
  const affectedUsers = new Set<string>();

  for (const [uid, list] of byUser) {
    // Newest by startTime is the survivor; older ones are duplicates.
    list.sort((a, b) => b.startMs - a.startMs);
    const [survivor, ...dupes] = list;

    for (const d of dupes) {
      closes.push({ _id: d.shift._id, endTime: new Date(d.effective), reason: shiftCloseReason.DUPLICATE });
      affectedUsers.add(uid);
    }

    const maxExceeded = nowMs - survivor.startMs >= maxCutoffMs;
    const idleExceeded = nowMs - survivor.effective >= idleCutoffMs;
    if (maxExceeded || idleExceeded) {
      // Idle takes precedence for the label; endTime is always the last activity.
      const reason = idleExceeded ? shiftCloseReason.INACTIVITY : shiftCloseReason.MAX_DURATION;
      closes.push({ _id: survivor.shift._id, endTime: new Date(survivor.effective), reason });
      affectedUsers.add(uid);
    }
  }

  for (const c of closes) summary.byReason[c.reason]++;
  summary.closed = closes.length;
  summary.usersAffected = affectedUsers.size;

  if (!dryRun && closes.length > 0) {
    await Shift.bulkWrite(
      closes.map((c) => ({
        updateOne: {
          // `status: IN_PROGRESS` in the filter makes a concurrent/repeat run a no-op.
          filter: { _id: c._id, status: shiftStatus.IN_PROGRESS },
          update: {
            $set: {
              status: shiftStatus.ENDED,
              endTime: c.endTime,
              autoClosed: true,
              closeReason: c.reason,
            },
          },
        },
      })),
    );
  }

  // Close every still-open visit that no longer has an open shift, so a stale
  // shift never leaves a stale visit behind. Two sources of stale visits:
  //   1. visits on the shifts we just closed above
  //   2. orphans on shifts already ENDED (or deleted) by earlier runs / manual
  //      closes — swept here so old data self-heals, not just future closes
  // A visit ends at its shift's endTime, clamped into [visit start, now] so
  // durations stay non-negative and never land in the future.
  {
    const openVisits: any[] = await Visit.find({ status: { $ne: shiftStatus.ENDED } }).lean();

    // endTime of shifts closed in this run (persisted only when !dryRun, so seed
    // from `closes` to keep dryRun accurate).
    const closeEndByShift = new Map<string, number>(
      closes.map((c) => [String(c._id), c.endTime.getTime()]),
    );
    // Look up the status/endTime of any other referenced shift (the orphan case).
    const otherShiftIds = [
      ...new Set(
        openVisits
          .map((v) => (v.shiftId ? String(v.shiftId) : null))
          .filter((id): id is string => !!id && !closeEndByShift.has(id)),
      ),
    ];
    const otherShifts: any[] = otherShiftIds.length
      ? await Shift.find({ _id: { $in: otherShiftIds } }, { status: 1, endTime: 1 }).lean()
      : [];
    const shiftById = new Map<string, any>(otherShifts.map((s) => [String(s._id), s]));

    const visitCloses: { _id: any; endTime: Date }[] = [];
    for (const v of openVisits) {
      const sid = v.shiftId ? String(v.shiftId) : null;
      let shiftEndMs: number | undefined;

      if (sid && closeEndByShift.has(sid)) {
        shiftEndMs = closeEndByShift.get(sid); // closed in this run
      } else {
        const shift = sid ? shiftById.get(sid) : null;
        // Shift still open → the visit is legitimately open; leave it alone.
        if (shift && shift.status !== shiftStatus.ENDED) continue;
        // Orphan on an ended shift; missing shift / endTime falls back to start.
        if (shift?.endTime) shiftEndMs = ms(shift.endTime);
      }

      const startMs = v.startTime ? ms(v.startTime) : v.createdAt ? ms(v.createdAt) : nowMs;
      let endMs = Number.isFinite(shiftEndMs as number) ? (shiftEndMs as number) : startMs;
      if (Number.isFinite(startMs) && endMs < startMs) endMs = startMs;
      if (endMs > nowMs) endMs = nowMs;
      visitCloses.push({ _id: v._id, endTime: new Date(endMs) });
    }

    summary.visitsClosed = visitCloses.length;

    if (!dryRun && visitCloses.length > 0) {
      await Visit.bulkWrite(
        visitCloses.map((v) => ({
          updateOne: {
            // `status != ENDED` filter keeps concurrent/repeat runs idempotent.
            filter: { _id: v._id, status: { $ne: shiftStatus.ENDED } },
            update: { $set: { status: shiftStatus.ENDED, endTime: v.endTime } },
          },
        })),
      );
    }
  }

  // Recompute isOnShift only for affected users, based on whether any open shift remains.
  const userOps: any[] = [];
  for (const uid of affectedUsers) {
    const stillOpen = dryRun
      ? await Shift.exists({ userId: uid, status: shiftStatus.IN_PROGRESS, _id: { $nin: closes.map((c) => c._id) } })
      : await Shift.exists({ userId: uid, status: shiftStatus.IN_PROGRESS });
    if (stillOpen) summary.usersStillOnShift++;
    userOps.push({ updateOne: { filter: { _id: uid }, update: { $set: { isOnShift: !!stillOpen } } } });
  }
  if (!dryRun && userOps.length > 0) await User.bulkWrite(userOps);

  return NextResponse.json(summary, { status: 200 });
}
