import React from 'react'
import AddNewMomForm from '@/components/AddNewMomForm'
import { cookies } from 'next/headers';
import { userRoles } from '@/models/enum.constants';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const CreateNewMomPage = async ({ searchParams }: PageProps) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const isAdmin = cookieStore.get('role')?.value === userRoles.ADMIN;

  // Await the searchParams promise
  const resolvedSearchParams = await searchParams;
  const visitId = resolvedSearchParams?.visitId as string | undefined;

  return (
    <div>
      <AddNewMomForm userToken={userToken} visit={visitId} isAdmin={isAdmin} />
    </div>
  );
};

export default CreateNewMomPage;