import CreateNewEmployee from '@/components/CreateNewEmployee'
// import { userRoles } from '@/models/enum.constants';
// import { redirect } from 'next/dist/server/api-utils';
import { cookies } from 'next/headers';
import React from 'react'

const CreateNewEmployeePage = async () => {
    const cookieStore = await cookies();
    const userToken = cookieStore.get('access_token')?.value;
    const role = cookieStore.get('role')?.value;

  // if (role !== userRoles.ADMIN) {
  //   redirect('/employees');
  // }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4'>اضافة موظف جديد</h1>
        <CreateNewEmployee role={role} userToken={userToken} />
    </div>
  )
}

export default CreateNewEmployeePage