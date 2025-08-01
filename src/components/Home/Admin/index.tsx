/* eslint-disable @typescript-eslint/no-explicit-any */

import { BookHeart, Hospital, MapPinHouse, UserCheck, Users } from 'lucide-react'
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import React from 'react'

const AdminDashboard = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const headersList = await headers();
  const host = headersList.get('host');
  
  async function getProductsData(userToken: any) {
    const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/product/get-all`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
    });
    return res.json();
    }
  const products = await getProductsData(userToken);

  
  const availableProducts = products.products.filter((p: { totalQuantity: number; }) => p.totalQuantity > 200);
  
  const lowStockProducts = products.products.filter((p: { totalQuantity: number; }) => p.totalQuantity <= 200 && p.totalQuantity >= 100);
  
  const outOfStockProducts = products.products.filter((p: { totalQuantity: number; }) => p.totalQuantity < 100);
  const productsWithoutQuestions = products.products.filter((p: { questions: string | any[]; }) => p.questions.length === 0);
  
  return (
    <div>
      <h1 className='font-bold mx-2.5 text-2xl my-10'>الصفحة الرئيسية للأدمن</h1>
      <div className='flex items-center justify-between flex-wrap'>
        <div className='w-1/5'>
          <div className='mx-2.5 px-5 flex items-center justify-start gap-8 bg-white rounded-xl'>
            <Users color='#5570F1' size={61} className='my-12'/>
            <div>
              <p>إجمالي عدد الموظفين</p>
              <p className='font-bold text-2xl'>1258</p>
            </div>
          </div>
        </div>
        <div className='w-1/5'>
          <div className='mx-2.5 px-5 flex items-center justify-start gap-8 bg-white rounded-xl'>
            <UserCheck color='#5570F1' size={61} className='my-12'/>
            <div>
              <p>في الدوام الان</p>
              <p className='font-bold text-2xl'>500</p>
            </div>
          </div>
        </div>
        <div className='w-1/5'>
          <div className='mx-2.5 px-5 flex items-center justify-start gap-8 bg-white rounded-xl'>
            <Hospital color='#5570F1' size={61} className='my-12'/>
            <div>
              <p>اجمالي عدد المستشفيات</p>
              <p className='font-bold text-2xl'>500</p>
            </div>
          </div>
        </div>
        <div className='w-1/5'>
          <div className='mx-2.5 px-5 flex items-center justify-start gap-8 bg-white rounded-xl'>
            <MapPinHouse color='#5570F1' size={61} className='my-12'/>
            <div>
              <p>اجمالي عدد الزيارات</p>
              <p className='font-bold text-2xl'>500</p>
            </div>
          </div>
        </div>
        <div className='w-1/5'>
          <div className='mx-2.5 px-5 flex items-center justify-start gap-8 bg-white rounded-xl'>
            <BookHeart color='#5570F1' size={61} className='my-12'/>
            <div>
              <p>اجمالي عدد الامهات</p>
              <p className='font-bold text-2xl'>200</p>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      {/* <div></div> */}


      {/* AVAILABLE PRODUCTS */}
      {availableProducts.length > 0 && (
        <div className='mt-10'>
          <div className='flex items-center gap-2'>
            <p className='bg-green-500 w-4 h-4 rounded-full mx-2.5'></p>
            <h1 className='text-2xl'>عدد المنتجات المتاحة: {availableProducts.length}</h1>
          </div>

          <div className='flex items-center justify-between flex-wrap'>
            {availableProducts.map((product: any) => (
              <Link href={`/products/${product._id}`} className='w-1/3' key={product._id}>
                <div className='m-2 p-4 rounded-lg bg-white'>
                  <div className='flex items-center justify-between gap-4'>
                  {product.name}
                  <p className='bg-green-500 rounded-full px-6 py-1 text-white'>متاح</p>
                  </div>
                  <div className='flex items-center justify-between gap-4 mt-10 text-[#73808C]'>
                  الكمية المتوفرة
                  <p className='text-black'>{product.totalQuantity}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}

      {/* LOW STOCK PRODUCTS */}
      {lowStockProducts.length > 0 && (
        <div className='mt-10'>
          <div className='flex items-center gap-2'>
            <p className='bg-orange-500 w-4 h-4 rounded-full mx-2.5'></p>
            <h1 className='text-2xl'>منتجات على وشك النفاذ: {lowStockProducts.length}</h1>
          </div>

          <div className='flex items-center justify-between flex-wrap'>
            {lowStockProducts.map((product: any) => (
              <Link href={`/products/${product._id}`} className='w-1/3' key={product._id}>
                <div className='m-2 p-4 rounded-lg bg-white'>
                  <div className='flex items-center justify-between gap-4'>
                  {product.name}
                  <p className='bg-orange-500 rounded-full px-6 py-1 text-white'>متاح</p>
                  </div>
                  <div className='flex items-center justify-between gap-4 mt-10 text-[#73808C]'>
                  الكمية المتوفرة
                  <p className='text-black'>{product.totalQuantity}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}

      {/* OUT OF STOCK PRODUCTS */}
      {outOfStockProducts.length > 0 && (
        <div className='mt-10'>
          <div className='flex items-center gap-2'>
            <p className='bg-red-500 w-4 h-4 rounded-full mx-2.5'></p>
            <h1 className='text-2xl'>منتجات نفذت من المخزون: {outOfStockProducts.length}</h1>
          </div>

          <div className='flex items-center justify-between flex-wrap'>
            {outOfStockProducts.map((product: any) => (
              <Link href={`/products/${product._id}`} className='w-1/3' key={product._id}>
                <div className='m-2 p-4 rounded-lg bg-white'>
                  <div className='flex items-center justify-between gap-4'>
                  {product.name}
                  <p className='bg-red-500 rounded-full px-6 py-1 text-white'>متاح</p>
                  </div>
                  <div className='flex items-center justify-between gap-4 mt-10 text-[#73808C]'>
                  الكمية المتوفرة
                  <p className='text-black'>{product.totalQuantity}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}

      {/* PRODUCTS WITHOUT QUESTIONS */}
      {productsWithoutQuestions.length > 0 && (
        <div className='mt-10'>
          <div className='flex items-center gap-2'>
            <p className='bg-blue-500 w-4 h-4 rounded-full mx-2.5'></p>
            <h1 className='text-2xl'>منتجات بدون أسئلة: {productsWithoutQuestions.length}</h1>
          </div>

          <div className='flex items-center justify-between flex-wrap'>
            {productsWithoutQuestions.map((product: any) => (
              <Link href={`/products/${product._id}`} className='w-1/3' key={product._id}>
                <div className='m-2 p-4 rounded-lg bg-white'>
                  <div className='flex items-center justify-between gap-4'>
                  {product.name}
                  <p className='bg-blue-500 rounded-full px-6 py-1 text-white'>اضف سؤال</p>
                  </div>
                  <div className='flex items-center justify-between gap-4 mt-10 text-[#73808C]'>
                  الكمية المتوفرة
                  <p className='text-black'>{product.totalQuantity}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}
    </div>
  )
}

export default AdminDashboard