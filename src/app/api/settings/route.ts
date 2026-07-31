/* eslint-disable @typescript-eslint/no-explicit-any */
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { Settings } from "@/models/Settings";
import { getSettings } from "@/utils/settings/getSettings";

export const dynamic = "force-dynamic";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const settings = await getSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to load settings" }, { status: 500 });
  }
}

/** Validate a numeric field within [min, max]; returns the number or a message. */
function num(value: unknown, min: number, max: number, label: string): { ok: true; value: number } | { ok: false; message: string } {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { ok: false, message: `${label} يجب أن يكون رقمًا بين ${min} و ${max}` };
  }
  return { ok: true, value: n };
}

export async function PUT(req: NextRequest) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const set: Record<string, unknown> = {};

    if (body.expectedStartFrom !== undefined) {
      if (!TIME_RE.test(String(body.expectedStartFrom))) {
        return NextResponse.json({ status: 400, message: "صيغة وقت بداية النافذة غير صحيحة (HH:MM)" }, { status: 400 });
      }
      set.expectedStartFrom = String(body.expectedStartFrom);
    }
    if (body.expectedStartTo !== undefined) {
      if (!TIME_RE.test(String(body.expectedStartTo))) {
        return NextResponse.json({ status: 400, message: "صيغة وقت نهاية النافذة غير صحيحة (HH:MM)" }, { status: 400 });
      }
      set.expectedStartTo = String(body.expectedStartTo);
    }

    const numeric: [string, number, number, string][] = [
      ["expectedHoursPerDay", 1, 24, "ساعات العمل اليومية"],
      ["expectedDaysPerWeek", 1, 7, "أيام العمل الأسبوعية"],
      ["graceMinutes", 0, 240, "دقائق السماح"],
      ["maxShiftHours", 1, 24, "الحد الأقصى لساعات الدوام"],
      ["inactivityMinutes", 5, 1440, "دقائق الخمول"],
      ["leaveMaxRetroDays", 0, 90, "مدة السماح بطلب استئذان عن يوم سابق"],
      ["geofenceRadiusMeters", 20, 5000, "نطاق تسجيل الحضور (متر)"],
      ["outOfStockThreshold", 0, 1000000, "حد نفاد المخزون"],
      ["lowStockThreshold", 0, 1000000, "حد المخزون المنخفض"],
    ];
    for (const [key, min, max, label] of numeric) {
      if (body[key] !== undefined) {
        const r = num(body[key], min, max, label);
        if (!r.ok) return NextResponse.json({ status: 400, message: r.message }, { status: 400 });
        set[key] = r.value;
      }
    }

    // Effective window bounds must be from <= to.
    const current = await getSettings();
    const from = (set.expectedStartFrom as string) ?? current.expectedStartFrom;
    const to = (set.expectedStartTo as string) ?? current.expectedStartTo;
    if (from > to) {
      return NextResponse.json({ status: 400, message: "بداية النافذة يجب أن تكون قبل نهايتها" }, { status: 400 });
    }

    // Stock buckets must be ordered: out-of-stock threshold below the low one.
    const outThreshold = (set.outOfStockThreshold as number) ?? current.outOfStockThreshold;
    const lowThreshold = (set.lowStockThreshold as number) ?? current.lowStockThreshold;
    if (outThreshold >= lowThreshold) {
      return NextResponse.json({ status: 400, message: "حد نفاد المخزون يجب أن يكون أقل من حد المخزون المنخفض" }, { status: 400 });
    }

    const updated = await Settings.findOneAndUpdate(
      { key: "global" },
      { $set: set },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    return NextResponse.json({ settings: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 500, message: err?.message || "Failed to update settings" }, { status: 500 });
  }
}
