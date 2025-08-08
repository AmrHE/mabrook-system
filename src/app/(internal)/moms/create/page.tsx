import React from 'react'
import AddNewMomForm from '@/components/AddNewMomForm'
import { cookies } from 'next/headers';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const CreateNewMomPage = async ({ searchParams }: PageProps) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  
  // Await the searchParams promise
  const resolvedSearchParams = await searchParams;
  const visitId = resolvedSearchParams?.visitId as string | undefined;

  return (
    <div>
      <AddNewMomForm userToken={userToken} visit={visitId} />
    </div>
  );
};

export default CreateNewMomPage;