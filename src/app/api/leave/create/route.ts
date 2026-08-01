/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/utils/auth/requireAuth";
import { LeaveRequest } from "@/models/LeaveRequest";
import { leaveStatus, leaveType } from "@/models/enum.constants";
import {
  addDaysToDayKey,
  dayKeyDiff,
  isValidDayKey,
  riyadhDayKey,
} from "@/utils/date/range";
import { getSettings } from "@/utils/settings/getSettings";

export const dynamic = "force-dynamic";

const PERMIT_TYPES = new Set<string>([leaveType.DELAY_PERMIT, leaveType.EARLY_LEAVE]);
const SINGLE_DAY_TYPES = new Set<string>([leaveType.DELAY_PERMIT, leaveType.EARLY_LEAVE, leaveType.CASUAL]);

const MIN_PERMIT_MINUTES = 15;
const MAX_PERMIT_MINUTES = 120;
const MAX_VACATION_DAYS = 60;

/**
 * Submit a time-off request. Open to every authenticated user — employees,
 * warehouse staff and admins alike all need to ask for leave.
 *
 * The requester is always taken from the verified token, never the body, so a
 * request can't be filed in someone else's name.
 */
export async function POST(req: NextRequest) {
  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "");
    const reason = String(body.reason ?? "").trim();

    if (!Object.values(leaveType).includes(type as leaveType)) {
      return NextResponse.json(
        { error: "Invalid leave type", message: "نوع الطلب غير صحيح" },
        { status: 400 },
      );
    }

    const startDay = String(body.startDay ?? "");
    if (!isValidDayKey(startDay)) {
      return NextResponse.json(
        { error: "Invalid startDay", message: "تاريخ البداية غير صحيح" },
        { status: 400 },
      );
    }

    // Permits and casual days are single-day by definition; only a vacation may
    // span a range, so an endDay sent for the others is ignored rather than trusted.
    const endDay = SINGLE_DAY_TYPES.has(type) ? startDay : String(body.endDay ?? startDay);
    if (!isValidDayKey(endDay)) {
      return NextResponse.json(
        { error: "Invalid endDay", message: "تاريخ النهاية غير صحيح" },
        { status: 400 },
      );
    }

    const span = dayKeyDiff(startDay, endDay);
    if (span < 0) {
      return NextResponse.json(
        { error: "Inverted range", message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" },
        { status: 400 },
      );
    }
    if (span + 1 > MAX_VACATION_DAYS) {
      return NextResponse.json(
        { error: "Range too long", message: `لا يمكن طلب إجازة أطول من ${MAX_VACATION_DAYS} يومًا` },
        { status: 400 },
      );
    }

    // Permit length. Never scales the money (an unpaid permit costs a flat quarter
    // day) but it does decide how much lateness / short hours are excused.
    let minutes: number | undefined;
    if (PERMIT_TYPES.has(type)) {
      minutes = Number(body.minutes);
      if (!Number.isFinite(minutes) || minutes < MIN_PERMIT_MINUTES || minutes > MAX_PERMIT_MINUTES) {
        return NextResponse.json(
          {
            error: "Invalid minutes",
            message: `مدة الاستئذان يجب أن تكون بين ${MIN_PERMIT_MINUTES} و ${MAX_PERMIT_MINUTES} دقيقة`,
          },
          { status: 400 },
        );
      }
      minutes = Math.round(minutes);
    }

    // Retro window: back-dating is allowed (nobody files a sick day in advance)
    // but bounded, so an already-paid month can't be rewritten indefinitely.
    const settings = await getSettings();
    const today = riyadhDayKey(new Date());
    const earliest = addDaysToDayKey(today, -settings.leaveMaxRetroDays);
    if (startDay < earliest) {
      return NextResponse.json(
        {
          error: "Outside the retroactive window",
          message:
            settings.leaveMaxRetroDays > 0
              ? `لا يمكن تقديم طلب عن تاريخ أقدم من ${settings.leaveMaxRetroDays} يومًا`
              : "لا يمكن تقديم طلب عن تاريخ ماضٍ",
        },
        { status: 400 },
      );
    }

    // One request per day per person. This single overlap rule covers every case
    // the business asked for: a delay permit and an early leave can't both sit on
    // one day, a day can't be requested twice, and a permit can't land inside an
    // already-approved vacation.
    //
    // The check and the insert share a transaction. MongoDB can't express "no
    // overlapping span" as a unique index (`$in` is illegal in a
    // partialFilterExpression), so this plus the form's submit lock is the guard.
    const session = await mongoose.startSession();
    let created: any = null;
    let conflict: any = null;
    let txError: any = null;

    try {
      await session.withTransaction(async () => {
        const existing = await LeaveRequest.findOne({
          userId: payload._id,
          isActive: true,
          status: { $in: [leaveStatus.PENDING, leaveStatus.APPROVED] },
          startDay: { $lte: endDay },
          endDay: { $gte: startDay },
        })
          .select("type startDay endDay status")
          .session(session)
          .lean();

        if (existing) {
          conflict = existing;
          return;
        }

        const [doc] = await LeaveRequest.create(
          [
            {
              userId: payload._id,
              type,
              startDay,
              endDay,
              daysCount: span + 1,
              minutes,
              reason,
              status: leaveStatus.PENDING,
            },
          ],
          { session },
        );
        created = doc;
      });
    } catch (e) {
      txError = e;
    } finally {
      await session.endSession();
    }

    if (conflict) {
      return NextResponse.json(
        {
          error: "Overlapping request",
          message: "لديك طلب آخر على نفس اليوم — لا يمكن الجمع بين طلبين في يوم واحد",
          conflict: { type: conflict.type, startDay: conflict.startDay, endDay: conflict.endDay },
        },
        { status: 400 },
      );
    }

    if (txError || !created) {
      return NextResponse.json(
        { error: txError?.message || "Server error", message: "حدث خطأ أثناء إرسال الطلب" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "تم إرسال الطلب بنجاح وهو الآن قيد المراجعة", leave: created },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", message: "حدث خطأ أثناء إرسال الطلب" },
      { status: 500 },
    );
  }
}
