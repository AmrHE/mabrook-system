/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react'
import { cookies, headers } from 'next/headers';
import AdminDashboardClient from './AdminClient';

const AdminDashboard = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const headersList = await headers();
  const host = headersList.get('host');
  
  async function getProductsData(userToken: any) {
    const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/product/get-all`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
    });
    return res.json();
  }

  async function getEmployeesData(userToken: any) {
  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/user/get-all`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
  }

  async function getHospitalsData(userToken: any) {
  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/hospitals/get-hospitals`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
  }

  async function getVisitsData(userToken: any) {
  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/visit/get-visits`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
  }

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

  const products = await getProductsData(userToken);
  const employees = await getEmployeesData(userToken);
  const hospitals = await getHospitalsData(userToken);
  const visits = await getVisitsData(userToken);
  const moms = await getMomsData(userToken);

  const data = {
    products,
    employees,
    hospitals,
    visits,
    moms,
  };
  
  return <AdminDashboardClient data={data} />;

}

export default AdminDashboard