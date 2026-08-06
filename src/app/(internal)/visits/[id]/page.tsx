export const dynamic = "force-dynamic";


/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from '@/utils/auth/serverSession.server';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import AddNewMomForm from '@/components/AddNewMomForm';
import { shiftStatus, userRoles } from '@/models/enum.constants';
import { ClientDataTable } from './client-data-table';
import { columns } from './columns';
import EndVisitButton from '@/components/EndVisitButton';
import ResumeVisitButton from '@/components/ResumeVisitButton';
import DeleteVisitButton from '@/components/DeleteVisitButton';
import LocationModal from '@/components/LocationModal';
import FenceBadge from '@/components/FenceBadge';
import LowMomRateBadge from '@/components/LowMomRateBadge';
import VisitNotesModal from '@/components/VisitNotesModal';
import {
  isLowMomRateVisit,
  visitDurationHours,
  visitMomsPerHour,
  type MomRateBaseline,
} from '@/utils/analytics/visitProductivity';


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
  const { userToken, payload } = await requireServerSession();
  const userId = payload._id;
  const userRole = payload.role;
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

  // Productivity is derived at read time from the team baseline the API returns.
  const momRateBaseline: MomRateBaseline | undefined = visit?.momRateBaseline;
  const durationHours = visit?.visit ? visitDurationHours(visit.visit) : null;
  const lowMomRate =
    visit?.visit && momRateBaseline ? isLowMomRateVisit(visit.visit, momRateBaseline) : null;
  const notesBy = visit?.visit?.notesUpdatedBy;

  // Gate on THIS visit's own status, not a browser-wide cookie. The cookie was
  // global, so opening an ended visit while another was open showed an "end
  // visit" button on the wrong record — and it died on browser close, hiding the
  // button on a visit that was genuinely still open.
  const isOwner = visit?.visit?.createdBy?._id === userId;
  const isVisitOpen = visit?.visit?.status === shiftStatus.IN_PROGRESS;
  const canEndVisit = isVisitOpen && (isOwner || userRole === userRoles.ADMIN);

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
        <div className='flex items-center justify-between mb-10'>
          <h1 className='text-gray-800 font-bold text-3xl'>زيارة مستشفى {visit.visit?.hospitalId?.name}</h1>
          {canEndVisit && (
            <EndVisitButton id={id} userToken={userToken}/>
          )}
          {!isVisitOpen && isOwner && (
            <ResumeVisitButton id={id} userToken={userToken}/>
          )}
        </div>
      )}

      <Tabs dir='rtl' defaultValue="visitDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="visitDetails" className='cursor-pointer'>تفاصيل الزيارة</TabsTrigger>
        <TabsTrigger value="moms" className='cursor-pointer'>تفاصيل الامهات</TabsTrigger>
        {isVisitOpen && isOwner &&(
          <TabsTrigger value="addNewMom" className='cursor-pointer'>اضافة ام جديدة</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="visitDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل الزيارة</h4>
        <div className='flex max-w-[350px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>التاريخ</p>
            {/* <p>رقم الزيارة</p> */}
            <p>توقيت البدأ</p>
            <p>توقيت الانتهاء</p>
            <p>مدة الزيارة</p>
            <p>الإنتاجية</p>
            <p>اسم الموظف</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{new Date(visit.visit.createdAt).toLocaleDateString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
              })}</p>
            {/* <p className='max-w-28 truncate'>{visit.visit._id}</p> */}
            <p>{new Date(visit.visit.startTime).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
            <p>{visit.visit.endTime
              ? new Date(visit.visit.endTime).toLocaleString("en-SA", {
                  timeZone: "Asia/Riyadh",
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : '—'}</p>
            <p>{durationHours != null ? `${durationHours} ساعة` : '—'}</p>
            <p>
              <LowMomRateBadge
                low={durationHours == null ? null : lowMomRate}
                momsPerHour={visitMomsPerHour(visit.visit)}
                baselineDays={momRateBaseline?.baselineDays}
              />
            </p>
            <p>{`${visit.visit.createdBy.firstName} ${visit.visit.createdBy.lastName}`}</p>
          </div>
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المستشفى</h4>
        <div className='flex max-w-[350px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اسم المستشفى</p>
            <p>المدينة</p>
            <p>الحي</p>
            <p>حالة الموقع</p>
            { (visit.visit.startLocation || visit.visit.endLocation) && <p>الموقع الجغرافي</p>}
          </div>
          <div className='flex flex-col gap-5'>
            <p>{visit.visit.hospitalId.name}</p>
            <p>{visit.visit.hospitalId.city}</p>
            <p>{visit.visit.hospitalId.district}</p>
            <p><FenceBadge status={visit.visit.startFenceStatus} distanceMeters={visit.visit.startDistanceMeters} /></p>
            { (visit.visit.startLocation || visit.visit.endLocation) && (
              <LocationModal
                start={visit.visit.startLocation}
                end={visit.visit.endLocation}
                hospital={visit.visit.hospitalId?.location}
                startLabel="بداية الزيارة"
                endLabel="نهاية الزيارة"
                title="موقع الزيارة"
                triggerText="عرض على الخريطة"
              />
            )}
          </div>
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>ملاحظات الزيارة</h4>
        <div className='max-w-[700px]'>
          {visit.visit.notes ? (
            <p className='whitespace-pre-wrap text-gray-700'>{visit.visit.notes}</p>
          ) : (
            <p className='text-gray-400'>لا توجد ملاحظات</p>
          )}
          <div className='mt-4'>
            <VisitNotesModal
              variant="inline"
              visitId={id}
              initialNotes={visit.visit.notes ?? ''}
              updatedByName={notesBy ? `${notesBy.firstName ?? ''} ${notesBy.lastName ?? ''}`.trim() : undefined}
              updatedAt={visit.visit.notesUpdatedAt ?? null}
              userToken={userToken}
            />
          </div>
        </div>

        <div className='mt-10'>
          {userRole === userRoles.ADMIN && (
            <DeleteVisitButton id={id} userToken={userToken!} />
          )}
        </div>

      </TabsContent>
      <TabsContent value="moms">
        <ClientDataTable columns={columns} data={processedMoms} />
      </TabsContent>
      <TabsContent value="addNewMom">
        <AddNewMomForm userToken={userToken} isAdmin={userRole === userRoles.ADMIN} />
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingleVisitPage