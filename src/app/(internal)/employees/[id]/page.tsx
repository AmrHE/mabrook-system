export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import Image from 'next/image';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import EditEmployeeForm from '@/components/EditEmployeeForm';
import DeleteEmployeeButton from '@/components/DeleteEmployeeButton';
import EmployeeShiftsTable from '@/components/EmployeeShiftsTable';
import EmployeeLeavesTable from '@/components/EmployeeLeavesTable';
import VisitsTable, { type VisitRow } from '@/components/VisitsTable';
import { userRoles, shiftStatus } from '@/models/enum.constants';
import {
  isLowMomRateVisit,
  visitDurationHours,
  visitMomsPerHour,
  type MomRateBaseline,
} from '@/utils/analytics/visitProductivity';

const coordText = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? `${loc.lat}, ${loc.lng}` : '';
const rawCoord = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? { lat: loc.lat, lng: loc.lng } : null;

async function getdEmployeeData(id: string, userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/user/get-user/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}


const SingledEmployeePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { userToken, payload } = await requireServerSession();
  const userRole = payload.role;
  const employee = await getdEmployeeData(id, userToken);

  // Same baseline the analytics use, so a visit's verdict here matches /visits.
  const momRateBaseline: MomRateBaseline | undefined = employee?.momRateBaseline;

  const processedVisits: VisitRow[] = (employee?.user?.visits || [])
    .filter((v: any) => v.isActive !== false)
    .map((v: any) => {
      const low = momRateBaseline ? isLowMomRateVisit(v, momRateBaseline) : null;
      const durationHours = visitDurationHours(v);

      return {
        id: v._id,
        hospitalName: v.hospitalId?.name ?? '—',
        city: v.hospitalId?.city ?? '—',
        district: v.hospitalId?.district ?? '—',
        momsCount: v.moms?.length ?? 0,
        statusLabel: v.status === shiftStatus.ENDED ? 'منتهية' : 'جارية',
        durationHours,
        momsPerHour: visitMomsPerHour(v),
        lowMomRate: durationHours == null ? null : low,
        lowMomRateLabel: durationHours == null || low == null ? '' : low ? 'نعم' : 'لا',
        baselineDays: momRateBaseline?.baselineDays,
        notes: v.notes ?? '',
        notesUpdatedAt: v.notesUpdatedAt ?? null,
        startLoc: rawCoord(v.startLocation),
        endLoc: rawCoord(v.endLocation),
        hospitalLoc: rawCoord(v.hospitalId?.location),
        startLocationText: coordText(v.startLocation),
        endLocationText: coordText(v.endLocation),
      };
    });

  const lowMomRateVisitsCount = processedVisits.filter((v) => v.lowMomRate).length;

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {employee && (
        <div className='flex items-center justify-between p-4 rounded-3xl mb-10'>
          <h1 className='text-gray-800 font-bold text-3xl mb-10'>تفاصيل الموظف</h1>

          {userRole === userRoles.ADMIN && (
            <DeleteEmployeeButton id={id} userToken={userToken!} />
          )}
        </div>
      )}

      <Tabs dir='rtl' defaultValue="employeeDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="employeeDetails" className='cursor-pointer'>بيانات الموظف</TabsTrigger>
        <TabsTrigger value="visits" className='cursor-pointer'>الزيارات</TabsTrigger>
        <TabsTrigger value="attendance" className='cursor-pointer'>الورديات والحضور</TabsTrigger>
        <TabsTrigger value="leaves" className='cursor-pointer'>الاستئذانات</TabsTrigger>
        <TabsTrigger value="editEmployee" className='cursor-pointer'>تعديل البيانات</TabsTrigger>
      </TabsList>
      <TabsContent value="employeeDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>بيانات الموظف</h4>
        <div className='flex max-w-[400px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>الاسم الاول</p>
            <p>الاسم الاخير</p>
            <p>البريد الإلكتروني</p>
            <p>رقم الهاتف</p>
            <p>الدور الوظيفي</p>
            <p>كلمة المرور</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{employee.user.firstName}</p>
            <p>{employee.user.lastName}</p>
            <p>{employee.user.email}</p>
            <p>{employee.user.phoneNumber}</p>
            <p>{employee.user.role}</p>
            <p>{employee.user.passwordHash}</p>
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>بيانات التسجيل</h4>
        <div className='flex max-w-[320px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>تاريخ إنشاء الحساب</p>
            <p>اخر تعديل</p>
            <p>اخر تسجيل دخول</p>
            <p>عدد الزيارات المسجلة</p>
            <p>عدد الدوامات المسجلة</p>
            <p>زيارات بإنتاجية منخفضة</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>
              {new Date(employee.user.createdAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p>{new Date(employee.user.updatedAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
            <p>{new Date(employee.user.lastLogin).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
            <p>{employee.user.visits.filter((visit: { isActive: boolean; }) => visit.isActive === true).length}</p>
            <p>{employee.user.shifts.length}</p>
            <p className={lowMomRateVisitsCount > 0 ? 'text-orange-600 font-medium' : ''}>{lowMomRateVisitsCount}</p>
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>البيانات المالية والهوية</h4>
        <div className='flex max-w-[400px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>الراتب</p>
            <p>عدد المستشفيات المعيّنة</p>
            <p>رقم الآيبان</p>
            <p>اسم البنك</p>
            <p>رقم الهوية</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{employee.user.salary ?? '—'}</p>
            <p>{employee.user.assignedHospitals?.length ?? 0}</p>
            <p>{employee.user.iban || '—'}</p>
            <p>{employee.user.bankName || '—'}</p>
            <p>{employee.user.identityNumber || '—'}</p>
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>المستشفيات المعيّنة</h4>
        {employee.user.assignedHospitals?.length ? (
          <div className='flex flex-wrap gap-2 max-w-[600px]'>
            {employee.user.assignedHospitals.map((h: any) => (
              <span key={h._id} className='rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700'>
                {h.name}{h.city ? ` — ${h.city}` : ''}
              </span>
            ))}
          </div>
        ) : (
          <p className='text-gray-400'>لا توجد مستشفيات معيّنة</p>
        )}

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>صورة الهوية</h4>
        {employee.user.identityImage ? (
          <Image
            src={employee.user.identityImage}
            alt="صورة الهوية"
            width={320}
            height={200}
            className="rounded-md border object-contain"
          />
        ) : (
          <p className='text-gray-400'>لا توجد صورة</p>
        )}
      </TabsContent>
      <TabsContent value="visits">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>زيارات الموظف</h4>
        <VisitsTable data={processedVisits} filename={`employee-${id}-visits.csv`} userToken={userToken} />
      </TabsContent>
      <TabsContent value="attendance">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>سجل الورديات والحضور (آخر ٦ أشهر)</h4>
        <EmployeeShiftsTable userToken={userToken} employeeId={id} />
      </TabsContent>
      <TabsContent value="leaves">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>سجل الاستئذانات والإجازات</h4>
        <EmployeeLeavesTable userToken={userToken} employeeId={id} />
      </TabsContent>
      <TabsContent value="editEmployee">
        <EditEmployeeForm userToken={userToken} employee={employee} />
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingledEmployeePage