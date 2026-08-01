/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { Visit } from "@/models/Visit";
import "@/models/User"; // ensure the User model is registered for populate
import { requireAuth } from "@/utils/auth/requireAuth";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 2000;

/**
 * Set (or clear) a visit's free-text note.
 *
 * Deliberately scoped to `notes` alone rather than a general visit updater: the
 * document also carries status, start/end times, the mom list and the geofence
 * verdict, and a route that structurally cannot reach those can never be used
 * to reopen an ended visit or fake a check-in.
 *
 * Open to any authenticated user, per product decision — the note is shared and
 * last-write-wins, which is why notesUpdatedBy/notesUpdatedAt are recorded.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await initDb();

  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const { payload } = auth;

  try {
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ status: 400, message: "معرّف الزيارة غير صحيح" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body?.notes !== "string") {
      return NextResponse.json({ status: 400, message: "الملاحظة غير صحيحة" }, { status: 400 });
    }

    // An empty string is valid — that is how a note gets cleared.
    const notes = body.notes.trim();
    if (notes.length > MAX_LENGTH) {
      return NextResponse.json(
        { status: 400, message: "الملاحظة طويلة جدًا (الحد الأقصى ٢٠٠٠ حرف)" },
        { status: 400 },
      );
    }

    // `isActive` only — never filter on deletedAt, which defaults to Date.now()
    // on every document. This also makes soft-deleted visits un-annotatable.
    const visit = await Visit.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: { notes, notesUpdatedAt: new Date(), notesUpdatedBy: payload._id } },
      { new: true, runValidators: true },
    ).populate({ path: "notesUpdatedBy", model: "User", select: "firstName lastName" });

    if (!visit) {
      return NextResponse.json({ status: 404, message: "لم يتم العثور على الزيارة" }, { status: 404 });
    }

    const by = visit.notesUpdatedBy as any;

    return NextResponse.json(
      {
        message: "تم حفظ الملاحظة",
        notes: visit.notes ?? "",
        notesUpdatedAt: visit.notesUpdatedAt,
        notesUpdatedByName: by ? `${by.firstName ?? ""} ${by.lastName ?? ""}`.trim() : "",
      },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "حدث خطأ أثناء حفظ الملاحظة" },
      { status: 500 },
    );
  }
}
