/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

async function getMomData(id: string, userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/mom/get-mom/${id}`, {
  cache: 'no-store',
  headers: {
    'Content-Type': 'application/json',
    authorization: `Bearer ${userToken}`,
  },
});
return res.json();
}

const SingleMomPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  const { id } = await params;
  const mom = await getMomData(id, userToken);
console.log(mom);
  const genders = mom?.mom?.genderOfNewborns?.reduce((acc: any, value: any) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {mom && (
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>{mom.mom.name}</h1>
      )}

      <Tabs dir='rtl' defaultValue="momDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="momDetails" className='cursor-pointer'>بيانات الأم</TabsTrigger>
        <TabsTrigger value="productDetails" className='cursor-pointer'>استطلاع الرأي</TabsTrigger>
      </TabsList>
      <TabsContent value="momDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>بيانات الأم</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>الاسم</p>
            <p>الجنسية</p>
            <p>العنوان</p>
            <p>تاريخ التسجيل</p>
            <p>اسم الموظف</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{mom.mom.name}</p>
            <p>{mom.mom.nationality}</p>
            <p>{mom.mom.address}</p>
            <p>{new Date(mom.mom.createdAt).toDateString()}</p>
            <p>{`${mom.mom.createdBy.firstName} ${mom.mom.createdBy.lastName}`}</p>
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>بيانات الأطفال</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اجمالي عدد الأطفال</p>
            <p>عدد الذكور</p>
            <p>عدد الايناث</p>
            <p>عدد حديثي الولادة</p>
            <p>عدد الذكور حديثي الولادة</p>
            <p>عدد الإيناث حديثي الولادة</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{mom.mom.numberOfKids}</p>
            <p>{mom.mom.numberOfMales}</p>
            <p>{mom.mom.numberOfFemales}</p>
            <p>{mom.mom.numberOfnewborns}</p>
            {genders && (
              <>
                <p>{genders['Male'] || 0}</p>
                <p>{genders['Female'] || 0}</p>
              </>
            )}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="productDetails">
        
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingleMomPage