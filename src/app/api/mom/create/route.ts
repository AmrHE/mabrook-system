/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from "@/utils/auth/requireAuth";
import { initDb } from '../../../../lib/mongoose';
import { Mom } from '@/models/Mom';
import { Visit } from '@/models/Visit';
import { Shift } from '@/models/Shift';
import { Product } from '@/models/Product';
import { shiftStatus } from '@/models/enum.constants';
import { resolveNationality } from '@/utils/nationality/nationalities.server';
import { resolveApps } from '@/utils/app/apps.server';
import { adjustHospitalStock } from '@/utils/stock/recompute';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: 'Cannot identify the user Please re-login and try again'});
  }

  const { name, age, nationality, address, numberOfKids, numberOfnewborns, numberOfMales, numberOfFemales, genderOfNewborns, visitId, phoneNumber, allowFutureCom, signature, installedApp, boxId } = await req.json();
  if ( !name ) {
    return NextResponse.json({ error: 'Must fill in the name', message: 'الرجاء إدخال اسم الأم' }, { status: 400 });
  }

  // Every mom receives exactly one box; picking it here both records the
  // distribution (mom.survey) and decrements that hospital's stock.
  if (!boxId) {
    return NextResponse.json({ error: 'boxId is required', message: 'الرجاء اختيار الصندوق' }, { status: 400 });
  }

  // These counts are required and must be valid non-negative numbers.
  const requiredCounts: Record<string, unknown> = { numberOfKids, numberOfnewborns, numberOfMales, numberOfFemales };
  for (const [key, val] of Object.entries(requiredCounts)) {
    if (val === '' || val == null || !Number.isFinite(Number(val)) || Number(val) < 0) {
      return NextResponse.json({ error: `${key} is required`, message: 'الرجاء تعبئة أعداد الأطفال والمواليد (أرقام صحيحة)' }, { status: 400 });
    }
  }

  const kids = Number(numberOfKids);
  const newborns = Number(numberOfnewborns);
  const males = Number(numberOfMales);
  const females = Number(numberOfFemales);

  // A gender must be provided for every newborn (empty array only when 0 newborns).
  if (!Array.isArray(genderOfNewborns) || genderOfNewborns.length !== newborns || genderOfNewborns.some((g: unknown) => g !== 'Male' && g !== 'Female')) {
    return NextResponse.json({ error: 'genderOfNewborns is required', message: 'يجب تحديد جنس كل مولود' }, { status: 400 });
  }

  // Nationality must come from the approved list (prevents free-text drift like
  // يمني/اليمن/yemeni). resolveNationality folds variants to the canonical
  // feminine spelling, which is what we store.
  const canonicalNationality = await resolveNationality(nationality);
  if (!canonicalNationality) {
    return NextResponse.json({ error: 'Invalid nationality', message: 'الجنسية غير موجودة في القائمة المعتمدة' }, { status: 400 });
  }

  // Optional. Canonicalize against the admin-managed list; unknown values are
  // silently dropped so free-text can't drift into the data.
  const canonicalApps = await resolveApps(installedApp);

  try {
    await initDb();

    // The selected box drives both the survey record and the stock decrement.
    const box = await Product.findOne({ _id: boxId, isActive: true });
    if (!box) {
      return NextResponse.json({ error: 'Box not found', message: 'الصندوق غير موجود' }, { status: 400 });
    }

    const session = await mongoose.startSession();
    let newMom: any = null;
    let txError: any = null;

    try {
      await session.withTransaction(async () => {
        const visit = await Visit.findById(visitId).session(session);
        if (!visit) throw new Error('Visit not found');

        const [mom] = await Mom.create([{
          createdBy: userPayload._id,
          name,
          age: age === "" || age == null ? undefined : Number(age),
          nationality: canonicalNationality,
          address,
          numberOfKids: kids,
          numberOfnewborns: newborns,
          numberOfMales: males,
          numberOfFemales: females,
          genderOfNewborns,
          visitId,
          phoneNumber,
          allowFutureCom,
          signature,
          installedApp: canonicalApps,
          // Distribution record: the given box + its (initially blank) questions.
          survey: [{
            product: box._id,
            QA: (box.questions || []).map((q: string) => ({ question: q, answer: "" })),
          }],
        }], { session });

        visit.moms.push(mom._id);
        await visit.save({ session });

        // Hand the box to the mom → one unit leaves this hospital's stock.
        // Quantity may go negative (out-of-stock is "warn but allow").
        if (visit.hospitalId) {
          await adjustHospitalStock(visit.hospitalId, box._id, -1, session);
        }

        newMom = mom;
      });
    } catch (e) {
      txError = e;
    } finally {
      await session.endSession();
    }

    if (txError || !newMom) {
      const msg = txError?.message === 'Visit not found' ? 'Visit not found' : 'Server error';
      return NextResponse.json({ error: msg, message: 'حدث خطأ أثناء إضافة الأم' }, { status: txError?.message === 'Visit not found' ? 404 : 500 });
    }

    // Mark shift activity (best-effort; never fail the mom creation).
    try {
      await Shift.updateOne(
        { userId: userPayload._id, status: shiftStatus.IN_PROGRESS },
        { $set: { lastActivityAt: new Date() } },
      );
    } catch (e) {
      console.error('Failed to bump shift lastActivityAt (mom):', e);
    }

    return NextResponse.json({ message: 'New Mom Added Successfully', mom: newMom }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err },{ status: 500 });
  }
}
