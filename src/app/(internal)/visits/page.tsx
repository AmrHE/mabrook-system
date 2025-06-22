/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import { columns } from "./columns";
import { ClientDataTable } from './client-data-table';

type ProcessedVisit = {
  id: string;
  hospitalName: string;
  city: string;
  district: string;
  momsCount: number;
  employeeName: string;
};

const VisitsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

    const headersList = await headers();
    const host = headersList.get('host');
  
    // console.log(host)

  const processedVisits: ProcessedVisit[] = [];

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
        momsCount: 5, // TODO: Replace with actual value if available
        employeeName: `${visit.createdBy.firstName} ${visit.createdBy.lastName}`,
      });
    });
    // console.log(processedVisits);
  }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4 mb-10'>الزيارات</h1>
      <ClientDataTable columns={columns} data={processedVisits} />
    </div>
  );
};

export default VisitsPage;