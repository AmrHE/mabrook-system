import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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

  const { name, district, city, location, employeeIds, managerName, managerPhone, managerEmail } = await req.json();
  if (!name || !district || !city) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Manager contact details are optional at creation — an employee registering a
  // hospital in the field often doesn't have them, and an admin can fill them in
  // later from the hospital's edit tab.
  const manager = {
    managerName: String(managerName ?? '').trim(),
    managerPhone: String(managerPhone ?? '').trim(),
    managerEmail: String(managerEmail ?? '').trim(),
  };
  if (manager.managerEmail && !/^\S+@\S+\.\S+$/.test(manager.managerEmail)) {
    return NextResponse.json({ error: 'البريد الإلكتروني لمدير المستشفى غير صحيح' }, { status: 400 });
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
    ...manager,
    createdBy: userPayload._id,
    productStocks,
  });

  if(!newHospital) {
    return NextResponse.json({ error: 'Something Went Wrong' }, { status: 400 });
  }

  // Employees only see — and can check in against — hospitals they are assigned
  // to, so an employee is always assigned to what they just created; otherwise
  // it would vanish from their list the moment they saved it. Admins pick the
  // assignees themselves in the dialog, and may pick none: a hospital with no
  // assignees is simply admin/warehouse-only until someone is assigned later.
  const isEmployee = userPayload.role === userRoles.EMPLOYEE;
  const assignees: string[] = isEmployee
    ? [userPayload._id]
    : userPayload.role === userRoles.ADMIN
      ? (Array.isArray(employeeIds) ? employeeIds : []).filter(
          (x: unknown): x is string => typeof x === 'string' && mongoose.isValidObjectId(x),
        )
      : [];

  if (assignees.length > 0) {
    try {
      // Role/isActive live in the filter so a hand-crafted id list can't assign
      // a hospital to an admin, a warehouse account, or a deleted user.
      await User.updateMany(
        { _id: { $in: assignees }, isActive: true, role: userRoles.EMPLOYEE },
        { $addToSet: { assignedHospitals: newHospital._id } },
      );
    } catch {
      if (isEmployee) {
        // Stranded otherwise: invisible to its creator and owned by nobody.
        // Undo rather than report a success they cannot see.
        await Hospital.deleteOne({ _id: newHospital._id });
        return NextResponse.json(
          { error: 'تعذّر تعيين المستشفى لك. الرجاء المحاولة مرة أخرى.' },
          { status: 500 },
        );
      }
      // For an admin the assignment was optional and the hospital is already
      // visible to them, so keep it and let them assign from its page.
      return NextResponse.json(
        {
          message: 'تمت إضافة المستشفى، لكن تعذّر تعيين الموظفين. يمكنك تعيينهم من صفحة المستشفى.',
          hospital: newHospital,
        },
        { status: 201 },
      );
    }
  }

  return NextResponse.json({ message: 'Hospital has been added successfully ', hospital: newHospital }, { status: 201 });

}
