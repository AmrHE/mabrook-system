/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { ClientDataTable } from './client-data-table'
import { cookies, headers } from 'next/headers';
import { columns } from "./columns";


type ProcessedHospitals = {
  id: string;
  name: string;
  city: string;
  district: string;
  employeeEmail: string;
  employeeName: string;
};

const HospitalsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  const headersList = await headers();
  const host = headersList.get('host');

    const processedHospitals: ProcessedHospitals[] = [];
    const data = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/hospitals/get-hospitals`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${userToken}`,
    },
  });

  const hospitals = await data.json();

  if (data.status === 200) {
    hospitals.hospitals.map((hospital: any) => {
      processedHospitals.push({
        id: hospital._id,
        name: hospital.name,
        city: hospital.city,
        district: hospital.district,
        employeeEmail: hospital.createdBy.email,
        employeeName: `${hospital.createdBy.firstName} ${hospital.createdBy.lastName}`,
      });
    });
  }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4 mb-10'>الزيارات</h1>
      <ClientDataTable columns={columns} data={processedHospitals} />
    </div>
  )
}

export default HospitalsPage