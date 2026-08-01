/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { Shift } from "@/models/Shift";
import { Visit } from "@/models/Visit";
import { shiftStatus } from "@/models/enum.constants";
import { riyadhDayKey } from "@/utils/date/range";
import { getSettings } from "@/utils/settings/getSettings";

/**
 * Everything the employee dashboard needs, read from the database.
 *
 * This replaces the `shiftStatus` / `visitStatus` / `currentVisit` cookies that
 * used to drive the UI. They were browser-session cookies, so closing the
 * browser erased them and the dashboard forgot an open shift that was still
 * very much open in Mongo — the bug this feature exists to fix. They were also
 * not scoped per user, so the next person to log in on a shared browser
 * inherited the previous one's visit id.
 *
 * A util rather than a self-fetch, matching `getSettings` / `buildLeaveLedger`:
 * the page calls it directly, which is both faster and avoids the `${host}`
 * dance the older pages have to do.
 */

export interface SessionDTO {
  startTime: string;
  endTime?: string;
  hospitalId?: string;
  hospitalName?: string;
  autoClosed?: boolean;
  closeReason?: string;
}

export interface DayShiftDTO {
  _id: string;
  dayKey: string;
  status: string;
  startTime: string;
  endTime?: string;
  currentSegmentStartedAt?: string;
  workedMinutes: number;
  sessionsCount: number;
  hospitalId?: string;
  hospitalName?: string;
  startLocation?: { lat?: number; lng?: number };
  endLocation?: { lat?: number; lng?: number };
  segments: SessionDTO[];
}

export interface VisitDTO {
  _id: string;
  status: string;
  startTime: string;
  endTime?: string;
  hospitalId?: string;
  hospitalName?: string;
}

export interface CurrentState {
  /** Server time — the live counter must not trust the device clock. */
  now: string;
  todayKey: string;
  /** Today's shift, still running. */
  shift: DayShiftDTO | null;
  /** Today's shift, closed — offer "استئناف الدوام". */
  resumableShift: DayShiftDTO | null;
  /** An open shift from a previous day; the cron will close it. */
  staleOpenShift: DayShiftDTO | null;
  openVisit: VisitDTO | null;
  /** Ended visits from today's shift that are still within the resume window. */
  resumableVisits: VisitDTO[];
}

const iso = (d: any) => (d ? new Date(d).toISOString() : undefined);
const hospitalName = (h: any) => (h && typeof h === "object" ? h.name : undefined);
const hospitalId = (h: any) =>
  h ? String(typeof h === "object" && h._id ? h._id : h) : undefined;

function toShiftDTO(doc: any): DayShiftDTO {
  return {
    _id: String(doc._id),
    dayKey: doc.dayKey,
    status: doc.status,
    startTime: iso(doc.startTime)!,
    endTime: iso(doc.endTime),
    currentSegmentStartedAt: iso(doc.currentSegmentStartedAt),
    workedMinutes: doc.workedMinutes ?? 0,
    sessionsCount: doc.sessionsCount ?? (doc.segments?.length || 1),
    hospitalId: hospitalId(doc.hospitalId),
    hospitalName: hospitalName(doc.hospitalId),
    startLocation: doc.startLocation,
    endLocation: doc.endLocation,
    segments: (doc.segments ?? []).map((s: any) => ({
      startTime: iso(s.startTime)!,
      endTime: iso(s.endTime),
      hospitalId: hospitalId(s.hospitalId),
      hospitalName: hospitalName(s.hospitalId),
      autoClosed: s.autoClosed,
      closeReason: s.closeReason,
    })),
  };
}

function toVisitDTO(doc: any): VisitDTO {
  return {
    _id: String(doc._id),
    status: doc.status,
    startTime: iso(doc.startTime)!,
    endTime: iso(doc.endTime),
    hospitalId: hospitalId(doc.hospitalId),
    hospitalName: hospitalName(doc.hospitalId),
  };
}

export async function getCurrentState(userId: string): Promise<CurrentState> {
  await initDb();

  const now = new Date();
  const todayKey = riyadhDayKey(now);

  const [today, staleOpen, settings] = await Promise.all([
    Shift.findOne({ userId, dayKey: todayKey })
      .populate({ path: "hospitalId", select: "name" })
      .populate({ path: "segments.hospitalId", select: "name" })
      .lean(),
    Shift.findOne({
      userId,
      status: shiftStatus.IN_PROGRESS,
      $or: [{ dayKey: { $ne: todayKey } }, { dayKey: { $exists: false } }],
    })
      .sort({ startTime: -1 })
      .lean(),
    getSettings(),
  ]);

  const todayDTO = today ? toShiftDTO(today) : null;
  const shift = todayDTO?.status === shiftStatus.IN_PROGRESS ? todayDTO : null;
  const resumableShift = todayDTO && !shift ? todayDTO : null;

  const openVisitDoc: any = await Visit.findOne({
    createdBy: userId,
    status: shiftStatus.IN_PROGRESS,
    isActive: true,
  })
    .sort({ startTime: -1 })
    .populate({ path: "hospitalId", select: "name" })
    .lean();

  // A visit may only be resumed inside today's shift and within the inactivity
  // window. The recency fuse is what stops a 09:00 visit reopened at 18:00 from
  // recording a nine-hour visit, and what keeps a legitimate A→B→A day as three
  // visits rather than two.
  let resumableVisits: VisitDTO[] = [];
  if (!openVisitDoc && todayDTO) {
    const cutoff = new Date(now.getTime() - settings.inactivityMinutes * 60000);
    const docs: any[] = await Visit.find({
      createdBy: userId,
      shiftId: todayDTO._id,
      status: shiftStatus.ENDED,
      isActive: true,
      endTime: { $gte: cutoff },
    })
      .sort({ endTime: -1 })
      .limit(5)
      .populate({ path: "hospitalId", select: "name" })
      .lean();
    resumableVisits = docs.map(toVisitDTO);
  }

  return {
    now: now.toISOString(),
    todayKey,
    shift,
    resumableShift,
    staleOpenShift: staleOpen ? toShiftDTO(staleOpen) : null,
    openVisit: openVisitDoc ? toVisitDTO(openVisitDoc) : null,
    resumableVisits,
  };
}
