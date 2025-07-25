/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

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
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  const { id } = await params;
  const hospital = await getHospitalData(id, userToken);


  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {hospital && (
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>مستشفى {hospital.hospital.name}</h1>
      )}

      <Tabs dir='rtl' defaultValue="hospitalDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="hospitalDetails" className='cursor-pointer'>تفاصيل المستشفى</TabsTrigger>
        {/* <TabsTrigger value="productDetails" className='cursor-pointer'>تفاصيل المنتجات</TabsTrigger> */} {/*TODO: add products & stock details tab*/}
      </TabsList>
      <TabsContent value="hospitalDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المستشفى</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اسم المستشفى</p>
            <p>المدينة</p>
            <p>الحي</p>
            <p>الموقع الجغرافي</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{hospital.hospital.name}</p>
            <p>{hospital.hospital.city}</p>
            <p>{hospital.hospital.district}</p>
            <a
            className='text-blue-500 hover:underline'
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.google.com/maps/?q=${hospital.hospital.location.lat},${hospital.hospital.location.lng}`}
            >Open In Google Maps</a>
          </div>
        </div>


        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل الموظف</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>رقم المستشفى</p>
            <p>اسم الموظف</p>
            {/* <p>ايميل الموظف</p> */}
            <p>توقيت الاضافة</p>
            {/* <p>اسم الموظف</p> */}
          </div>
          <div className='flex flex-col gap-5'>
            <p className='max-w-28 truncate'>{hospital.hospital._id}</p>
            <p>{`${hospital.hospital.createdBy.firstName} ${hospital.hospital.createdBy.lastName}`}</p>
            {/* <p className='max-w-28 truncate'>{hospital.hospital.createdBy.email}</p> */}
            <p>{new Date(hospital.hospital.createdAt).toDateString()}</p>
            {/* <p>{new Date(hospital.hospital.startTime).toLocaleTimeString()}</p> */}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="productDetails">
        
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingleHospitalPage