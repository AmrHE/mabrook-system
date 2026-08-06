/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import HospitalStockDetails from '@/components/HospitalStockDetails';
import { userRoles } from '@/models/enum.constants';
import DeleteHospitalButton from '@/components/DeleteHospitalButton';
import EditHospitalForm from '@/components/EditHospitalForm';
import LocationModal from '@/components/LocationModal';

async function getHospitalData(id: string, userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/hospitals/get-hospital/${id}`, {
  cache: 'no-store',
  headers: {
    'Content-Type': 'application/json',
    authorization: `Bearer ${userToken}`,
  },
});
return res.json();
}


const SingleHospitalPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { userToken, payload } = await requireServerSession();
  const userRole = payload.role;
  const isAdmin = userRole === userRoles.ADMIN;


  const { id } = await params;
  const hospital = await getHospitalData(id, userToken);

  const h = hospital?.hospital;

  // An employee opening a hospital they aren't assigned to gets a 403, leaving
  // `h` undefined. Without this guard HospitalStockDetails would receive
  // `productStocks={undefined}` and throw on .map().
  if (!h) {
    return (
      <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
        <h1 className='text-gray-800 font-bold text-3xl mb-4'>غير مصرح لك بعرض هذه المستشفى</h1>
        <p className='text-gray-500'>
          يمكنك عرض المستشفيات المعيّنة لك فقط. تواصل مع المدير لتعيينك إلى مستشفى.
        </p>
      </div>
    );
  }

  const hasLocation = h?.location?.lat != null && h?.location?.lng != null;
  const assignedEmployees: any[] = hospital?.assignedEmployees || [];
  const assignedNames = assignedEmployees.map((e) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()).filter(Boolean).join('، ');

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {hospital && (
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>مستشفى {h?.name}</h1>
      )}

      <Tabs dir='rtl' defaultValue="hospitalDetails" className="w-full">
      <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <TabsTrigger value="hospitalDetails" className='cursor-pointer'>تفاصيل المستشفى</TabsTrigger>
        <TabsTrigger value="productDetails" className='cursor-pointer'>تفاصيل المنتجات</TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="editHospital" className='cursor-pointer'>تعديل البيانات</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="hospitalDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المستشفى</h4>
        <div className='flex max-w-[350px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اسم المستشفى</p>
            <p>المدينة</p>
            <p>الحي</p>
            <p>الموقع الجغرافي</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{h?.name}</p>
            <p>{h?.city}</p>
            <p>{h?.district}</p>
            {hasLocation ? (
              <LocationModal
                hospital={h.location}
                title="موقع المستشفى"
                hospitalLabel="المستشفى"
              />
            ) : (
              <span className='text-amber-600'>غير محدد</span>
            )}
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>بيانات مدير المستشفى</h4>
        <div className='flex max-w-[350px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اسم المدير</p>
            <p>رقم الجوال</p>
            <p>البريد الإلكتروني</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{h?.managerName || <span className='text-gray-400'>غير محدد</span>}</p>
            <p dir='ltr' className='text-right'>
              {h?.managerPhone ? (
                <a href={`tel:${h.managerPhone}`} className='text-[#5570F1] hover:underline'>{h.managerPhone}</a>
              ) : (
                <span className='text-gray-400'>غير محدد</span>
              )}
            </p>
            <p dir='ltr' className='text-right'>
              {h?.managerEmail ? (
                <a href={`mailto:${h.managerEmail}`} className='text-[#5570F1] hover:underline'>{h.managerEmail}</a>
              ) : (
                <span className='text-gray-400'>غير محدد</span>
              )}
            </p>
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>الموظفون المعينون</h4>
        <div className='flex max-w-[350px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>الموظفون المعينون</p>
            <p>توقيت الاضافة</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{assignedNames || <span className='text-gray-400'>لا يوجد موظفون معينون</span>}</p>
            <p>{new Date(h?.createdAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
          </div>
        </div>

        <div className='mt-10 flex flex-wrap items-center gap-4'>
          {isAdmin && (
            <DeleteHospitalButton id={id} userToken={userToken!} />
          )}
        </div>


      </TabsContent>
      <TabsContent value="productDetails">
        <HospitalStockDetails userToken={userToken} productStocks={h?.productStocks} hospitalName={h?.name} />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="editHospital">
          <h4 className='mt-8 mb-2 font-semibold text-gray-700 text-xl'>تعديل بيانات المستشفى</h4>
          <EditHospitalForm
            id={id}
            userToken={userToken!}
            initialName={h?.name}
            initialCity={h?.city}
            initialDistrict={h?.district}
            initialLocation={hasLocation ? h.location : null}
            initialAssignedEmployeeIds={assignedEmployees.map((e) => e._id)}
            initialManagerName={h?.managerName}
            initialManagerPhone={h?.managerPhone}
            initialManagerEmail={h?.managerEmail}
            isAdmin={isAdmin}
          />
        </TabsContent>
      )}
    </Tabs>
    </div>
  )
}

export default SingleHospitalPage
