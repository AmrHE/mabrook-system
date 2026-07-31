/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import VisitsTable, { type VisitRow } from '@/components/VisitsTable';
import { shiftStatus } from '@/models/enum.constants';
import { fenceStatusLabel } from '@/utils/geo/geofence';

const coordText = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? `${loc.lat}, ${loc.lng}` : '';
const rawCoord = (loc: any) =>
  loc && Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? { lat: loc.lat, lng: loc.lng } : null;

const VisitsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  const headersList = await headers();
  const host = headersList.get('host');

  const processedVisits: VisitRow[] = [];

  const data = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/visit/get-visits`, {

    method: 'GET',
    headers: {
      authorization: `Bearer ${userToken}`,
    },
  });

  const visits = await data.json();

  if (data.status === 200) {
    visits.visits.map((visit: any) => {
      processedVisits.push({
        id: visit._id,
        hospitalName: visit.hospitalId.name,
        city: visit.hospitalId.city,
        district: visit.hospitalId.district,
        momsCount: visit?.moms?.length || 0,
        employeeName: `${visit.createdBy.firstName} ${visit.createdBy.lastName}`,
        statusLabel: visit.status === shiftStatus.ENDED ? 'منتهية' : 'جارية',
        startLoc: rawCoord(visit.startLocation),
        endLoc: rawCoord(visit.endLocation),
        hospitalLoc: rawCoord(visit.hospitalId?.location),
        startLocationText: coordText(visit.startLocation),
        endLocationText: coordText(visit.endLocation),
        fenceStatus: visit.startFenceStatus,
        fenceDistance: visit.startDistanceMeters ?? null,
        fenceLabel: fenceStatusLabel(visit.startFenceStatus),
      });
    });
  }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4 mb-6'>الزيارات</h1>
      <VisitsTable data={processedVisits} showEmployee filename="visits.csv" />
    </div>
  );
};

export default VisitsPage;
