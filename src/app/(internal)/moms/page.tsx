/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import { columns } from "./columns";
import { ClientDataTable } from './client-data-table';

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

const MomsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const headersList = await headers();
  const host = headersList.get('host');
  
  async function getMomsData(userToken: any) {
    const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/mom/get-moms`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
    });
    return res.json();
    }
  const moms = await getMomsData(userToken);

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

  return (
    <div>
      <h1 className='text-3xl font-bold p-4 mb-10'>الأمهات</h1>
      <ClientDataTable columns={columns} data={processedMoms} />
    </div>
  );
};

export default MomsPage;