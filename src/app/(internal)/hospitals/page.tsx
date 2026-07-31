/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import AddNewHospitalDialog from '@/components/AddNewHospitalDialog';
import HospitalsTable, { type HospitalRow } from '@/components/HospitalsTable';
import { userRoles } from '@/models/enum.constants';

const rawCoord = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? { lat: loc.lat, lng: loc.lng } : null;
const coordText = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? `${loc.lat}, ${loc.lng}` : '';

const HospitalsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const isAdmin = cookieStore.get('role')?.value === userRoles.ADMIN;

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
        <h1 className='text-3xl font-bold p-4'>المستشفيات</h1>
        <AddNewHospitalDialog userToken={userToken} isAdmin={isAdmin} />
      </div>
      <HospitalsTable data={processedHospitals} />
    </div>
  )
}

export default HospitalsPage
