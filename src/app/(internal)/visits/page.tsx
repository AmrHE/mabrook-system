/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import VisitsTable, { type VisitRow } from '@/components/VisitsTable';
import { shiftStatus } from '@/models/enum.constants';
import { fenceStatusLabel } from '@/utils/geo/geofence';
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

const VisitsPage = async () => {
  const { userToken } = await requireServerSession();

  const headersList = await headers();
  const host = headersList.get('host');

  const processedVisits: VisitRow[] = [];

  const data = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/visit/get-visits`, {

    method: 'GET',
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${userToken}`,
    },
  });

  const visits = await data.json();

  if (data.status === 200) {
    const baseline: MomRateBaseline = visits.momRateBaseline;

    visits.visits.map((visit: any) => {
      // Productivity is derived here rather than stored, using the team baseline
      // the API shipped alongside the rows.
      const low = baseline ? isLowMomRateVisit(visit, baseline) : null;
      const durationHours = visitDurationHours(visit);
      const notesBy = visit.notesUpdatedBy;

      processedVisits.push({
        id: visit._id,
        hospitalName: visit.hospitalId.name,
        city: visit.hospitalId.city,
        district: visit.hospitalId.district,
        momsCount: visit?.moms?.length || 0,
        employeeName: `${visit.createdBy.firstName} ${visit.createdBy.lastName}`,
        statusLabel: visit.status === shiftStatus.ENDED ? 'منتهية' : 'جارية',
        durationHours,
        momsPerHour: visitMomsPerHour(visit),
        lowMomRate: durationHours == null ? null : low,
        lowMomRateLabel: durationHours == null || low == null ? '' : low ? 'نعم' : 'لا',
        baselineDays: baseline?.baselineDays,
        notes: visit.notes ?? '',
        notesUpdatedByName: notesBy ? `${notesBy.firstName ?? ''} ${notesBy.lastName ?? ''}`.trim() : undefined,
        notesUpdatedAt: visit.notesUpdatedAt ?? null,
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
      <VisitsTable data={processedVisits} showEmployee filename="visits.csv" userToken={userToken} />
    </div>
  );
};

export default VisitsPage;
