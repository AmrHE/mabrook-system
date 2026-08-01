import CreateNewProduct from '@/components/CreateNewProduct'
// import { userRoles } from '@/models/enum.constants';
// import { redirect } from 'next/dist/server/api-utils';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import React from 'react'

const CreateNewProductPage = async () => {
    const { userToken } = await requireServerSession();

  // if (payload.role !== userRoles.ADMIN) {
  //   redirect('/employees');
  // }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4'>اضافة منتج جديد</h1>
        <CreateNewProduct userToken={userToken} />
    </div>
  )
}

export default CreateNewProductPage