/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import { columns } from "./columns";
import FilterableTable from '@/components/FilterableTable';
import { stockStatus } from '@/utils/stock/thresholds';

type Product = {
  id: string;
  name: string;
  totalQuantity: number;
  hospitalsQuantity: number;
  stockLabel: string;
}

const ProductsPage = async () => {
  const { userToken } = await requireServerSession();
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
  const thresholds = products.thresholds; // admin-configured; falls back to defaults

  const processedProducts: Product[] = [];
  if (products.products.length > 0) {
    products.products.map((product: any) => {
      const total = product.totalQuantity ?? 0;
      processedProducts.push({
        id: product._id,
        name: product.name,
        totalQuantity: product.totalQuantity,
        hospitalsQuantity: product.hospitalsQuantity,
        stockLabel: stockStatus(total, thresholds?.outOfStock, thresholds?.lowStock),
      });
    });
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-3xl font-bold p-4'>الصناديق</h1>
      </div>
      <FilterableTable
        data={processedProducts}
        columns={columns}
        basePath="/products"
        filename="boxes.csv"
        searchKeys={['name']}
        searchPlaceholder="ابحث باسم الصندوق"
        filters={[
          {
            key: 'stockLabel',
            label: 'حالة المخزون',
            options: [
              { label: 'متاح', value: 'متاح' },
              { label: 'منخفض', value: 'منخفض' },
              { label: 'نفذ', value: 'نفذ' },
            ],
          },
        ]}
        exportColumns={[
          { key: 'name', header: 'اسم الصندوق' },
          { key: 'totalQuantity', header: 'إجمالي المخزون' },
          { key: 'stockLabel', header: 'حالة المخزون' },
        ]}
      />
    </div>
  );
};

export default ProductsPage;
