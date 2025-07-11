/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import AddNewMomForm from '@/components/AddNewMomForm';
import { shiftStatus } from '@/models/enum.constants';
import { ClientDataTable } from './client-data-table';
import { columns } from './columns';


type Mom = {
  id: string;
  name: string;
  nationality: string;
  address: string;
  numberOfKids: number;
  numberOfnewborns: number;
  numberOfMales: number;
  numberOfFemales: number;
}

const SingleVisitPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const userId = cookieStore.get('userId')?.value;
  const headersList = await headers();
  const host = headersList.get('host');

  const { id } = await params;

  async function getVisitData(id: string, userToken: any) {
  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/visit/get-visit/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}

async function getMomsData(visitId: string, userToken: any) {
  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/visit/get-visit/${id}/get-moms`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}

  const visit = await getVisitData(id, userToken);
  const moms = await getMomsData(id, userToken);

  const processedMoms: Mom[] = [];
  if (moms.moms.length > 0) {
    moms.moms.map((mom: any) => {
      processedMoms.push({
        id: mom._id,
        name: mom.name,
        nationality: mom.nationality,
        address: mom.address,
        numberOfKids: mom.numberOfKids,
        numberOfnewborns: mom.numberOfnewborns,
        numberOfMales: mom.numberOfMales,
        numberOfFemales: mom.numberOfFemales,
      });
    });
  }

  if(!visit) {
    return (
      <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>لا توجد زيارة بهذا المعرف</h1>
      </div>
    );
  }

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {visit && (
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>زيارة مستشفى {visit.visit.hospitalId.name}</h1>
      )}

      <Tabs dir='rtl' defaultValue="visitDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="visitDetails" className='cursor-pointer'>تفاصيل الزيارة</TabsTrigger>
        <TabsTrigger value="moms" className='cursor-pointer'>تفاصيل الامهات</TabsTrigger>
        {visit.visit.status === shiftStatus.IN_PROGRESS && visit.visit.createdBy._id === userId &&(
          <TabsTrigger value="addNewMom" className='cursor-pointer'>اضافة ام جديدة</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="visitDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل الزيارة</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>التاريخ</p>
            <p>رقم الزيارة</p>
            <p>توقيت البدأ</p>
            <p>اسم الموظف</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{new Date(visit.visit.startTime).toDateString()}</p>
            <p className='max-w-28 truncate'>{visit.visit._id}</p>
            <p>{new Date(visit.visit.startTime).toLocaleTimeString()}</p>
            <p>{`${visit.visit.createdBy.firstName} ${visit.visit.createdBy.lastName}`}</p>
          </div>
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المستشفى</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اسم المستشفى</p>
            <p>المدينة</p>
            <p>الحي</p>
            <p>الموقع الجغرافي</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{visit.visit.hospitalId.name}</p>
            <p>{visit.visit.hospitalId.city}</p>
            <p>{visit.visit.hospitalId.district}</p>
            <a
            className='text-blue-500 hover:underline'
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.google.com/maps/?q=${visit.visit.hospitalId.location.lat},${visit.visit.hospitalId.location.lng}`}
            >Open In Google Maps</a>
          </div>
        </div>

      </TabsContent>
      <TabsContent value="moms">
        <ClientDataTable columns={columns} data={processedMoms} />
      </TabsContent>
      <TabsContent value="addNewMom">
        <AddNewMomForm userToken={userToken} />
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingleVisitPage


// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { cookies, headers } from 'next/headers';
// import React from 'react'
// import {
//   Tabs,
//   TabsContent,
//   TabsList,
//   TabsTrigger,
// } from "@/components/ui/tabs"
// import AddNewMomForm from '@/components/AddNewMomForm';
// import VisitDetailsTabs from '@/components/VisitDetailsTabs';


// async function getVisitData(id: string, userToken: any) {
//   const headersList = await headers();
//   const host = headersList.get('host');
//   const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/visit/get-visit/${id}`, {
//     cache: 'no-store',
//     headers: {
//       'Content-Type': 'application/json',
//       authorization: `Bearer ${userToken}`,
//     },
//   });
//   return res.json();
// }

// // async function getMomsData(visitId: string, userToken: any) {}

// const SingleVisitPage = async ({ params }: { params: Promise<{ id: string }> }) => {
//   const cookieStore = await cookies();
//   const userToken = cookieStore.get('access_token')?.value;

//   const { id } = await params;
//   const visit = await getVisitData(id, userToken);

//   return (
//     <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
//       {visit && (
//         <h1 className='text-gray-800 font-bold text-3xl mb-10'>زيارة مستشفى {visit.visit.hospitalId.name}</h1>
//       )}
//       <VisitDetailsTabs visit={visit}/>
//     </div>
//   )
// }

// export default SingleVisitPage