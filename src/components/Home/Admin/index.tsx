import React from 'react'
import { cookies } from 'next/headers';
import AdminDashboardClient from './AdminClient';

const AdminDashboard = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  return <AdminDashboardClient userToken={userToken} />;
};

export default AdminDashboard;
