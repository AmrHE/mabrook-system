/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import AddNewHospitalDialog from '@/components/AddNewHospitalDialog';
import HospitalsTable, { type HospitalRow } from '@/components/HospitalsTable';
import { userRoles } from '@/models/enum.constants';

const rawCoord = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? { lat: loc.lat, lng: loc.lng } : null;
const coordText = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? `${loc.lat}, ${loc.lng}` : '';

const HospitalsPage = async () => {
  const { userToken, payload } = await requireServerSession();
  const isAdmin = payload.role === userRoles.ADMIN;

  const headersList = await headers();
  const host = headersList.get('host');

  const processedHospitals: HospitalRow[] = [];
  const data = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/hospitals/get-hospitals`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${userToken}`,
    },
  });

  const hospitals = await data.json();

  if (data.status === 200) {
    hospitals.hospitals.map((hospital: any) => {
      const assigned = (hospital.assignedEmployees || []).map((e: any) => `${e.firstName} ${e.lastName}`.trim());
      processedHospitals.push({
        id: hospital._id,
        name: hospital.name,
        city: hospital.city,
        district: hospital.district,
        assignedEmployeesText: assigned.length ? assigned.join('، ') : '—',
        location: rawCoord(hospital.location),
        locationText: coordText(hospital.location),
      });
    });
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        {/* Employees only ever see their own assignments, so name the list for
            what it is rather than letting a short list look like missing data. */}
        <h1 className='text-3xl font-bold p-4'>{isAdmin ? 'المستشفيات' : 'المستشفيات المعيّنة لي'}</h1>
        {isAdmin && <AddNewHospitalDialog userToken={userToken} isAdmin={isAdmin} />}
      </div>
      {processedHospitals.length === 0 && !isAdmin ? (
        // The shared DataTable's empty state is a hardcoded English "No results."
        <div className='rounded-2xl bg-gray-50 px-6 py-10 text-center'>
          <p className='text-gray-700 font-medium mb-1'>لم يتم تعيينك إلى أي مستشفى بعد.</p>
          <p className='text-gray-500 text-sm'>تواصل مع المدير لتعيينك إلى المستشفيات التي ستعمل بها.</p>
        </div>
      ) : (
        <HospitalsTable data={processedHospitals} />
      )}
    </div>
  )
}

export default HospitalsPage
