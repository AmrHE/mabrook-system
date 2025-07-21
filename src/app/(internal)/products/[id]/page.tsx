/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { userRoles } from '@/models/enum.constants';

const SingleProductPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const userRole = cookieStore.get('role')?.value;
  const headersList = await headers();
  const host = headersList.get('host');

  const { id } = await params;

  async function getProductData(id: string, userToken: any) {
  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/product/get-product/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}

  const product = await getProductData(id, userToken);

  if(!product) {//TODO: MAKE A PROPER ERROR HANDLING FOR THIS CASES AND THE WHOLE APP
    return (
      <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>لا يوجد منتج بهذا المعرف</h1>
      </div>
    );
  }

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {product && (
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>منتج {product.product.name}</h1>
      )}

      <Tabs dir='rtl' defaultValue="productDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="productDetails" className='cursor-pointer'>تفاصيل المنتج</TabsTrigger>
        <TabsTrigger value="editQuantity" className='cursor-pointer'>تعديل الكميات</TabsTrigger>
        {userRole === userRoles.ADMIN &&(
          <TabsTrigger value="addQuestions" className='cursor-pointer'>اضافة اسئلة</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="productDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>بيانات المتج</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اسم المنتج</p>
            <p>رقم المنتج</p>
            <p>وصف المنتج</p>
            <p>حجم المنتج</p>
            <p>تاريخ الاضافة</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{product.product.name}</p>
            <p className='max-w-28 truncate'>{product.product._id}</p>
            <p>{product.product.description}</p>
            <p>{product.product.size}</p>
            <p>{new Date(product.product.createdAt).toDateString()}</p>
          </div>
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المخزون</h4>
        <div className='flex max-w-[300px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>اجمالي المخزون</p>
            <p>مخزون المستودع</p>
            <p>مخزون المستشفيات</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{product.product.totalQuantity}</p>
            <p>{product.product.warehouseQuantity}</p>
            <p>{product.product.hospitalsQuantity}</p>
          </div>
        </div>

      </TabsContent>
      <TabsContent value="editQuantity">
        {/* <ClientDataTable columns={columns} data={processedMoms} /> */}
      </TabsContent>
      <TabsContent value="addQuestions">
        {/* <AddNewMomForm userToken={userToken} /> */}
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingleProductPage