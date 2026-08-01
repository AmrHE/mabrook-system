/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Shift } from "@/models/Shift";
import { Visit } from "@/models/Visit";
import { User } from "@/models/User";
import { shiftStatus, shiftCloseReason } from "@/models/enum.constants";
import { getSettings } from "@/utils/settings/getSettings";
import { effectiveActivityMs, loadActivitySignals } from "@/utils/shift/lastActivity";

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
 * Auto-close forgotten shift sessions. Triggered by an external scheduler
 * (cron-job.org) with the `X-Cron-Secret` header. Idempotent and safe to run
 * frequently.
 *
 * IMPORTANT: since logging out no longer ends a shift, this job is the ONLY
 * automatic closer. It must run at least as often as `inactivityMinutes`
 * (default 60), or abandoned sessions accrue hours until the max-duration cap.
 *
 * "Closing" means closing the shift's CURRENT OPEN SEGMENT, not deleting the
 * day: the shift document is the day's container and the employee may resume it
 * later with "استئناف الدوام". `endTime` is always the last real activity, so
 * idle time never counts as worked hours.
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("X-Cron-Secret"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const { maxShiftHours, inactivityMinutes } = await getSettings();
  const now = new Date();
  const nowMs = now.getTime();
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
    /** Must stay 0 once the {userId, dayKey} unique index exists. */
    duplicatesFound: 0,
    oldestOpenHours: 0,
    dryRun,
  };

  // Don't early-return when no shifts are open: the visit sweep below still
  // needs to run so orphaned open visits get closed even during off-hours.
  const shiftIds = open.map((s) => s._id);
  const { visitMax, momMax } = await loadActivitySignals(shiftIds);

  /**
   * Per-shift start of the OPEN SEGMENT plus its effective last activity.
   *
   * The one substitution that makes this correct after a resume is using
   * `currentSegmentStartedAt` rather than the shift's `startTime`. Because
   * `effectiveActivityMs` clamps to that lower bound, any visit or mom
   * timestamp belonging to an EARLIER session of the same day is discarded
   * automatically — no extra per-segment filtering is needed. Resist the urge
   * to "fix" this into something more elaborate.
   */
  const enriched = open.map((s) => {
    const segments: any[] = s.segments ?? [];
    const openSeg = segments.find((seg) => !seg.endTime);

    let openStartMs = ms(s.currentSegmentStartedAt ?? openSeg?.startTime ?? s.startTime ?? s.createdAt);
    if (!Number.isFinite(openStartMs)) {
      openStartMs = nowMs;
      summary.dataIssues++;
    }

    const sid = String(s._id);
    const effective = effectiveActivityMs({
      openStartMs,
      lastActivityAt: s.lastActivityAt,
      visitMax: visitMax.get(sid),
      momMax: momMax.get(sid),
      nowMs,
    });

    return { shift: s, openStartMs, effective, workedMs: (s.workedMinutes ?? 0) * 60000 };
  });

  for (const e of enriched) {
    const hours = (nowMs - e.openStartMs) / 3600000;
    if (hours > summary.oldestOpenHours) summary.oldestOpenHours = Math.round(hours * 10) / 10;
  }

  // Group by user. Post-collapse a user should hold at most ONE open shift;
  // anything more means the unique index is missing, so it is reported as well
  // as repaired.
  const byUser = new Map<string, typeof enriched>();
  for (const e of enriched) {
    const uid = String(e.shift.userId);
    (byUser.get(uid) ?? byUser.set(uid, []).get(uid)!).push(e);
  }

  type CloseOp = { _id: any; endTime: Date; reason: shiftCloseReason; addedMinutes: number };
  const closes: CloseOp[] = [];
  const affectedUsers = new Set<string>();

  const addedMinutesFor = (openStartMs: number, endMs: number) =>
    Math.max(0, Math.round((endMs - openStartMs) / 60000));

  for (const [uid, list] of byUser) {
    // Newest open segment is the survivor; anything older is a duplicate.
    list.sort((a, b) => b.openStartMs - a.openStartMs);
    const [survivor, ...dupes] = list;

    if (dupes.length) summary.duplicatesFound += dupes.length;
    for (const d of dupes) {
      closes.push({
        _id: d.shift._id,
        endTime: new Date(d.effective),
        reason: shiftCloseReason.DUPLICATE,
        addedMinutes: addedMinutesFor(d.openStartMs, d.effective),
      });
      affectedUsers.add(uid);
    }

    // MAX_DURATION is measured over the DAY's worked time, not this session's.
    // Otherwise 6h + a five-minute break + 6h would never trip the cap, which
    // is exactly what the cap exists to bound.
    const workedSoFarMs = survivor.workedMs + (nowMs - survivor.openStartMs);
    const maxExceeded = workedSoFarMs >= maxCutoffMs;
    const idleExceeded = nowMs - survivor.effective >= idleCutoffMs;

    if (maxExceeded || idleExceeded) {
      // Idle takes precedence for the label; endTime is always the last activity.
      const reason = idleExceeded ? shiftCloseReason.INACTIVITY : shiftCloseReason.MAX_DURATION;

      // Land the day exactly ON the cap rather than overshooting it.
      const capEnd = survivor.openStartMs + Math.max(0, maxCutoffMs - survivor.workedMs);
      const endMs = Math.min(survivor.effective, maxExceeded ? capEnd : survivor.effective);

      closes.push({
        _id: survivor.shift._id,
        endTime: new Date(endMs),
        reason,
        addedMinutes: addedMinutesFor(survivor.openStartMs, endMs),
      });
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
          // Matching the open segment positionally, with `status: IN_PROGRESS`
          // and an unset segment endTime in the filter, is what makes a
          // concurrent or repeated run a no-op.
          filter: {
            _id: c._id,
            status: shiftStatus.IN_PROGRESS,
            "segments.endTime": null,
          },
          update: {
            $set: {
              "segments.$.endTime": c.endTime,
              "segments.$.autoClosed": true,
              "segments.$.closeReason": c.reason,
              status: shiftStatus.ENDED,
              endTime: c.endTime,
              autoClosed: true,
              closeReason: c.reason,
            },
            $unset: { currentSegmentStartedAt: "" },
            $inc: { workedMinutes: c.addedMinutes },
          },
        },
      })),
    );

    // Legacy shifts predate `segments[]`, so the positional filter above misses
    // them. Close those the plain way.
    const legacy = closes.filter((c) => {
      const e = enriched.find((x) => String(x.shift._id) === String(c._id));
      return !(e?.shift.segments ?? []).some((s: any) => !s.endTime);
    });
    if (legacy.length) {
      await Shift.bulkWrite(
        legacy.map((c) => ({
          updateOne: {
            filter: { _id: c._id, status: shiftStatus.IN_PROGRESS },
            update: {
              $set: {
                status: shiftStatus.ENDED,
                endTime: c.endTime,
                autoClosed: true,
                closeReason: c.reason,
              },
              $unset: { currentSegmentStartedAt: "" },
            },
          },
        })),
      );
    }
  }

  // Close every still-open visit that no longer has a session to belong to.
  // Three sources of stale visits:
  //   1. visits on the shifts we just closed above
  //   2. orphans on shifts already ENDED (or deleted) by earlier runs / manual
  //      closes — swept here so old data self-heals, not just future closes
  //   3. NEW since shifts collapse by day: a visit left open in an earlier
  //      SESSION while the employee resumed into a later one. Its shift is
  //      still IN_PROGRESS, so the old "skip open shifts" rule would leak it
  //      open forever.
  // A visit ends at its session's end, clamped into [visit start, now] so
  // durations stay non-negative and never land in the future.
  {
    const openVisits: any[] = await Visit.find({ status: { $ne: shiftStatus.ENDED } }).lean();

    // endTime of shifts closed in this run (persisted only when !dryRun, so seed
    // from `closes` to keep dryRun accurate).
    const closeEndByShift = new Map<string, number>(
      closes.map((c) => [String(c._id), c.endTime.getTime()]),
    );
    const otherShiftIds = [
      ...new Set(
        openVisits
          .map((v) => (v.shiftId ? String(v.shiftId) : null))
          .filter((id): id is string => !!id && !closeEndByShift.has(id)),
      ),
    ];
    const otherShifts: any[] = otherShiftIds.length
      ? await Shift.find(
          { _id: { $in: otherShiftIds } },
          { status: 1, endTime: 1, segments: 1, currentSegmentStartedAt: 1 },
        ).lean()
      : [];
    const shiftById = new Map<string, any>(otherShifts.map((s) => [String(s._id), s]));

    const visitCloses: { _id: any; endTime: Date }[] = [];
    for (const v of openVisits) {
      const sid = v.shiftId ? String(v.shiftId) : null;
      const startMs = v.startTime ? ms(v.startTime) : v.createdAt ? ms(v.createdAt) : nowMs;
      let shiftEndMs: number | undefined;

      if (sid && closeEndByShift.has(sid)) {
        shiftEndMs = closeEndByShift.get(sid); // closed in this run
      } else {
        const shift = sid ? shiftById.get(sid) : null;

        if (shift && shift.status !== shiftStatus.ENDED) {
          // Case 3: the shift is open, but is the VISIT stranded in a session
          // that has already finished?
          const currentStart = shift.currentSegmentStartedAt
            ? ms(shift.currentSegmentStartedAt)
            : null;
          if (!currentStart || startMs >= currentStart) continue; // legitimately open

          const owning = (shift.segments ?? [])
            .filter((seg: any) => seg.endTime && ms(seg.startTime) <= startMs)
            .sort((a: any, b: any) => ms(b.startTime) - ms(a.startTime))[0];
          shiftEndMs = owning?.endTime ? ms(owning.endTime) : currentStart;
        } else if (shift?.endTime) {
          // Orphan on an ended shift; missing shift / endTime falls back to start.
          shiftEndMs = ms(shift.endTime);
        }
      }

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
