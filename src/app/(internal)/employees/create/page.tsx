import CreateNewEmployee from '@/components/CreateNewEmployee'
// import { userRoles } from '@/models/enum.constants';
// import { redirect } from 'next/dist/server/api-utils';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import React from 'react'

const CreateNewEmployeePage = async () => {
    const { userToken } = await requireServerSession();

  // if (payload.role !== userRoles.ADMIN) {
  //   redirect('/employees');
  // }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4'>اضافة موظف جديد</h1>
        <CreateNewEmployee userToken={userToken} />
    </div>
  )
}

export default CreateNewEmployeePage