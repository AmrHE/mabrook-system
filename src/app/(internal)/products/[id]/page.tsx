/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
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
  const { userToken, payload } = await requireServerSession();
  const userRole = payload.role;
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
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>لا يوجد صندوق بهذا المعرف</h1>
      </div>
    );
  }

  const perHospital: any[] = product.perHospital || [];

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {product && (
        <h1 className='text-gray-800 font-bold text-3xl mb-10'>صندوق {product.product.name}</h1>
      )}

      <Tabs dir='rtl' defaultValue="productDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="productDetails" className='cursor-pointer'>تفاصيل الصندوق</TabsTrigger>
        <TabsTrigger value="editProduct" className='cursor-pointer'>تعديل الصندوق</TabsTrigger>
        {userRole === userRoles.ADMIN &&(
          <TabsTrigger value="addQuestions" className='cursor-pointer'>اضافة اسئلة</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="productDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>بيانات الصندوق</h4>
        <div className='flex flex-col gap-6 overflow-hidden'>
          <div className='flex items-start gap-20'>
            <p>اسم الصندوق</p>
            <p>{product.product.name}</p>
          </div>
          <div className='flex items-start gap-20'>
            <p>تاريخ الاضافة</p>
            <p className='truncate'>{new Date(product.product.createdAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
          </div>
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>إجمالي المخزون</h4>
        <div className='flex flex-col gap-6 overflow-hidden'>
          <div className='flex items-start gap-20'>
            <p>إجمالي المخزون (كل المستشفيات)</p>
            <p>{product.product.totalQuantity ?? 0}</p>
          </div>
        </div>

        <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>المخزون حسب المستشفى</h4>
        {perHospital.length === 0 ? (
          <p className='text-gray-400'>لا يوجد مخزون في أي مستشفى بعد</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full max-w-2xl text-sm'>
              <thead>
                <tr className='text-gray-500 border-b'>
                  <th className='text-start py-2 font-medium'>المستشفى</th>
                  <th className='text-start py-2 font-medium'>المدينة</th>
                  <th className='text-start py-2 font-medium'>الكمية</th>
                  <th className='text-start py-2 font-medium'>آخر تزويد</th>
                </tr>
              </thead>
              <tbody>
                {perHospital.map((h: any) => (
                  <tr key={h.hospitalId} className='border-b last:border-0'>
                    <td className='py-2'>{h.hospitalName}</td>
                    <td className='py-2 text-gray-500'>{h.city || '—'}</td>
                    <td className={`py-2 font-medium ${h.quantity <= 0 ? 'text-red-600' : ''}`}>{h.quantity}</td>
                    <td className='py-2 text-gray-500'>
                      {h.lastRestockedAt
                        ? new Date(h.lastRestockedAt).toLocaleDateString("en-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium" })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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