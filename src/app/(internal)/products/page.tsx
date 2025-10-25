/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import { columns } from "./columns";
import { ClientDataTable } from './client-data-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  // imageUrl: string; TODO IMPLEMENT IMAGE UPLOAD
  size: string;
  totalQuantity: number;
  warehouseQuantity: number;
  hospitalsQuantity: number;
}

const ProductsPage = async () => {
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

  const processedProducts: Product[] = [];
  if (products.products.length > 0) {
    products.products.map((product: any) => {
      processedProducts.push({
        id: product._id,
        name: product.name,
        // imageUrl: product.imageUrl,
        size: product.size,
        totalQuantity: product.totalQuantity,
        warehouseQuantity: product.warehouseQuantity,
        hospitalsQuantity: product.hospitalsQuantity,
      });
    })/*.sort((a: Product, b: Product) => a.totalQuantity - b.totalQuantity);*/
  }

  return (
    <div>
      <div className='flex items-center justify-between p-4 rounded-3xl mb-10'>
        <h1 className='text-3xl font-bold p-4 mb-10'>المنتجات</h1>
        <Button>
          <Link href="/products/create">إضافة منتج جديد</Link>
        </Button>
      </div>

      <ClientDataTable columns={columns} data={processedProducts} />
    </div>
  );
};

export default ProductsPage;