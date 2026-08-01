import React from 'react'
import { requireServerSession } from "@/utils/auth/serverSession.server";
import AdminDashboardClient from './AdminClient';

const AdminDashboard = async () => {
  const { userToken } = await requireServerSession();

  return <AdminDashboardClient userToken={userToken} />;
};

export default AdminDashboard;
