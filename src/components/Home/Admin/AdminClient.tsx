/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookHeart, Hospital, MapPinHouse, UserCheck, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardProps {
  data: {
    products: any;
    employees: any;
    hospitals: any;
    visits: any;
    moms: any;
  };
}

const FILTERS = [
  { label: 'اليوم', value: 'day' },
  { label: 'الأسبوع الماضي', value: 'week' },
  { label: 'آخر أسبوعين', value: '2weeks' },
  { label: 'الشهر الماضي', value: 'month' },
  { label: 'آخر 3 أشهر', value: '3months' },
  { label: 'آخر 6 أشهر', value: '6months' },
  { label: 'السنة الماضية', value: 'year' },
];

const AdminDashboardClient: React.FC<DashboardProps> = ({ data }) => {
  const [filter, setFilter] = useState('6months');

  // ⏱️ Compute start date range dynamically
  const startDate = useMemo(() => {
    const now = new Date();
    const date = new Date(now);

    switch (filter) {
      case 'day':
        date.setDate(now.getDate() - 1);
        break;
      case 'week':
        date.setDate(now.getDate() - 7);
        break;
      case '2weeks':
        date.setDate(now.getDate() - 14);
        break;
      case 'month':
        date.setMonth(now.getMonth() - 1);
        break;
      case '3months':
        date.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        date.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        date.setFullYear(now.getFullYear() - 1);
        break;
    }
    return date;
  }, [filter]);

  // 🔍 Filter based on createdAt or date fields
  const filterByDate = (arr: any[]) =>
    arr.filter((item) => new Date(item.createdAt) >= startDate);

  const filteredData = {
    // products: filterByDate(data.products?.products || []),
    employees: filterByDate(data.employees?.users || []),
    hospitals: filterByDate(data.hospitals?.hospitals || []),
    visits: filterByDate(data.visits?.visits || []),
    moms: filterByDate(data.moms?.moms || []),
  };

  // Product categories
  const availableProducts = /*filteredData.*/data.products.products.filter((p: { totalQuantity: number; }) => p.totalQuantity > 200);
  const lowStockProducts = /*filteredData.*/data.products.products.filter(
    (p: { totalQuantity: number; }) => p.totalQuantity <= 200 && p.totalQuantity >= 100
  );
  const outOfStockProducts = /*filteredData.*/data.products.products.filter((p: { totalQuantity: number; }) => p.totalQuantity < 100);
  const productsWithoutQuestions = /*filteredData.*/data.products.products.filter(
    (p: { questions: string | any[]; }) => !p.questions || p.questions.length === 0
  );

  return (
    <div>
      <div className='flex md:items-center flex-col md:flex-row justify-between mb-6 px-2 gap-4'>
        <h1 className='font-bold text-2xl'>الصفحة الرئيسية للأدمن</h1>
        <Select value={filter} onValueChange={(value) => setFilter(value)}>
          <SelectTrigger className="w-[200px] border border-gray-300 rounded-lg p-2">
            <SelectValue placeholder="اختر المدة الزمنية" />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* STATS SECTION */}
      <div className='flex items-start md:items-center justify-between flex-wrap flex-col md:flex-row'>
        <StatCard
          icon={<Users className='my-12' color='#5570F1' size={61} />}
          label='إجمالي عدد الموظفين'
          value={filteredData.employees.length}
        />
        <StatCard
          icon={<UserCheck className='my-12' color='#5570F1' size={61} />}
          label='في الدوام الآن'
          value={filteredData.employees.filter((e) => e.isOnShift).length}
        />
        <StatCard
          icon={<Hospital className='my-12' color='#5570F1' size={61} />}
          label='إجمالي عدد المستشفيات'
          value={filteredData.hospitals.length}
        />
        <StatCard
          icon={<MapPinHouse className='my-12' color='#5570F1' size={61} />}
          label='إجمالي عدد الزيارات'
          value={filteredData.visits.length}
        />
        <StatCard
          icon={<BookHeart className='my-12' color='#5570F1' size={61} />}
          label='إجمالي عدد الأمهات'
          value={filteredData.moms.length}
        />
      </div>

      {availableProducts.length > 0 && (
        <ProductSection
          color='green'
          title={`عدد المنتجات المتاحة (${availableProducts.length})`}
          products={availableProducts}
        />
      )}
      {lowStockProducts.length > 0 && (
        <ProductSection
          color='orange'
          title={`منتجات على وشك النفاذ (${lowStockProducts.length})`}
          products={lowStockProducts}
        />
      )}
      {outOfStockProducts.length > 0 && (
        <ProductSection
          color='red'
          title={`منتجات نفذت من المخزون (${outOfStockProducts.length})`}
          products={outOfStockProducts}
        />
      )}
      {productsWithoutQuestions .length > 0 && (
        <ProductSection
          color='blue'
          title={`منتجات بدون اسئلة (${productsWithoutQuestions .length})`}
          products={productsWithoutQuestions }
        />
      )}
    </div>
  );
};

export default AdminDashboardClient;

// ⛳ Helper Components
const StatCard = ({ icon, label, value }: any) => (
  <div className='w-full md:w-1/5'>
    <div className='m-2.5 px-5 flex items-center justify-start gap-8 bg-white rounded-xl'>
      {icon}
      <div>
        <p>{label}</p>
        <p className='font-bold text-2xl'>{value}</p>
      </div>
    </div>
  </div>
);

const ProductSection = ({ color, title, products }: any) => (
  <div className='mt-10'>
    <div className='flex items-center gap-2'>
      <p className={`bg-${color}-500 w-4 h-4 rounded-full mx-2.5`}></p>
      <h1 className='text-2xl'>{title}</h1>
    </div>
    <div className='flex items-start md:items-center justify-between flex-col md:flex-row flex-wrap'>
      {products.map((product: any) => (
        <Link href={`/products/${product._id}`} className='w-full md:w-1/3' key={product._id}>
          <div className='m-2 p-4 rounded-lg bg-white'>
            <div className='flex items-center justify-between gap-4'>
              {product.name}
              <p className={`bg-${color}-500 rounded-full px-6 py-1 text-white`}>متاح</p>
            </div>
            <div className='flex items-center justify-between gap-4 mt-10 text-[#73808C]'>
              الكمية المتوفرة <p className='text-black'>{product.totalQuantity}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  </div>
);
