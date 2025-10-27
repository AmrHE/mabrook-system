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
import EditProductForm from '@/components/EditProductForm';
import AddQuestionsForm from '@/components/AddQuestionsForm';
import DeletedProductButton from '@/components/DeleteProductButton';

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

  if(product.status === 404) {
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
        <TabsTrigger value="editProduct" className='cursor-pointer'>تعديل المنتج</TabsTrigger>
        {userRole === userRoles.ADMIN &&(
          <TabsTrigger value="addQuestions" className='cursor-pointer'>اضافة اسئلة</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="productDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>بيانات المتج</h4>
        <div className='flex flex-col gap-6 overflow-hidden'>
          <div className='flex items-start gap-20'>
            <p>اسم المنتج</p>
            <p>{product.product.name}</p>
          </div>
          {/* <div className='flex items-start gap-20'>
            <p>رقم المنتج</p>
            <p className='truncate'>{product.product._id}</p>
          </div> */}
          <div className='flex items-start gap-20'>
            <p>وصف المنتج</p>
            <p className='max-w-4/6'>{product.product.description}</p>
          </div>
          <div className='flex items-start gap-20'>
            <p>حجم المنتج</p>
            <p className='truncate'>{product.product.size}</p>
          </div>
          <div className='flex items-start gap-20'>
            <p>تاريخ الاضافة</p>
            <p className='truncate'>{new Date(product.product.createdAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
          </div>
          {/* <div className='flex items-start gap-20'>
            <p>تاريخ اخر تعديل</p>
            <p className='truncate'>{new Date(product.product.updatedAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
          </div> */}
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المخزون</h4>
        <div className='flex flex-col gap-6 overflow-hidden'>
          <div className='flex items-start gap-20'>
            <p>اجمالي المخزون</p>
            <p>{product.product.totalQuantity}</p>
          </div>
          <div className='flex items-start gap-20'>
            <p>مخزون المستودع</p>
            <p>{product.product.warehouseQuantity}</p>
          </div>
          <div className='flex items-start gap-20'>
            <p>مخزون المستشفيات</p>
            <p>{product.product.hospitalsQuantity}</p>
          </div>
        </div>

        <div className='mt-10'>
          {userRole === userRoles.ADMIN && (
            <DeletedProductButton id={id} userToken={userToken!} />
          )}
        </div>

      </TabsContent>
      <TabsContent value="editProduct">
        <EditProductForm userToken={userToken} product={product.product}/>
      </TabsContent>
      <TabsContent value="addQuestions">
        <AddQuestionsForm userToken={userToken} product={product.product}/>
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingleProductPage