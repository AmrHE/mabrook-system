import React from 'react'
import AddNewMomForm from '@/components/AddNewMomForm'
import { requireServerSession } from "@/utils/auth/serverSession.server";
import { userRoles } from '@/models/enum.constants';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const CreateNewMomPage = async ({ searchParams }: PageProps) => {
  const { userToken, payload } = await requireServerSession();
  const isAdmin = payload.role === userRoles.ADMIN;

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