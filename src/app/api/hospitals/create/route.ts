import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from "@/utils/auth/requireAuth";
import { initDb } from '../../../../lib/mongoose';
import { Hospital } from '@/models/Hospital';
import { Product } from '@/models/Product';
import { User } from '@/models/User';
import { userRoles } from '@/models/enum.constants';
import { resolveCity, resolveDistrict } from '@/utils/geo/locations.server';

export async function POST(req: NextRequest) {
  await initDb();

  // Open to any authenticated user: employees discover hospitals in the field
  // and register them themselves. The one they create is assigned to them below.
  const auth = requireAuth(req);
  if (auth.error) return auth.error;
  const userPayload = auth.payload;

  if (!userPayload._id) {
    return NextResponse.json({status: 400, message: 'Cannot identify the user Please re-login and try again'});
  }

  const { name, district, city, location } = await req.json();
  if (!name || !district || !city) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // City/district must come from the approved list (prevents free-text spelling
  // drift like جدة/جده). resolveCity/resolveDistrict fold trivial variants back to
  // the canonical spelling, which is what we store.
  const canonicalCity = await resolveCity(city);
  if (!canonicalCity) {
    return NextResponse.json({ error: 'المدينة غير موجودة في القائمة المعتمدة' }, { status: 400 });
  }
  const canonicalDistrict = await resolveDistrict(canonicalCity, district);
  if (!canonicalDistrict) {
    return NextResponse.json({ error: 'الحي غير موجود في القائمة المعتمدة لهذه المدينة' }, { status: 400 });
  }

  // Location is optional at creation — admins can backfill it later. Only keep a
  // pair when both values are finite numbers.
  const loc = location as { lat?: unknown; lng?: unknown } | null | undefined;
  const sanitizedLocation =
    loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))
      ? { lat: Number(loc.lat), lng: Number(loc.lng) }
      : undefined;

  const existingHostpital = await Hospital.findOne({ name });
  if (existingHostpital) {
    return NextResponse.json({ error: 'Hostpital already exists' }, { status: 409 });
  }

    const products = await Product.find({isActive: true});
    const productStocks = products.map(product => ({
      product: product._id,
      quantity: 0,
      lastRestockedAt: null
    }));

  const newHospital = await Hospital.create({
    name,
    district: canonicalDistrict,
    city: canonicalCity,
    location: sanitizedLocation,
    createdBy: userPayload._id,
    productStocks,
  });

  if(!newHospital) {
    return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
  }

  // Employees only see (and can check in against) hospitals they are assigned
  // to, so without this an employee would create a hospital and immediately
  // lose sight of it. Admins and warehouse users already see everything, and
  // assigning them would just pollute their assignment list.
  if (userPayload.role === userRoles.EMPLOYEE) {
    try {
      await User.updateOne(
        { _id: userPayload._id },
        { $addToSet: { assignedHospitals: newHospital._id } },
      );
    } catch {
      // Leaving the hospital behind would strand it: invisible to its creator
      // and owned by nobody. Undo rather than report a success they can't see.
      await Hospital.deleteOne({ _id: newHospital._id });
      return NextResponse.json(
        { error: 'تعذّر تعيين المستشفى لك. الرجاء المحاولة مرة أخرى.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: 'Hospital has been added successfully ', hospital: newHospital }, { status: 201 });

}
