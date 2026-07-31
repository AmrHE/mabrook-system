/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import { columns } from "./columns";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import FilterableTable from '@/components/FilterableTable';
import { userRoles } from '@/models/enum.constants';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  onShiftLabel: string;
  visitCount: number;
}

const UsersPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const headersList = await headers();
  const host = headersList.get('host');

  async function getEmployeessData(userToken: any) {
    const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/user/get-all`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
    });
    return res.json();
    }
  const employees = await getEmployeessData(userToken);

  const processedEmployees: Employee[] = [];
  if (employees.users.length > 0) {
    employees.users.map((employee: any) => {
      processedEmployees.push({
        id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phoneNumber: employee.phoneNumber,
        role: employee.role,
        onShiftLabel: employee.isOnShift ? 'نعم' : 'لا',
        visitCount: employee.visits.filter((visit: { isActive: boolean; }) => visit.isActive === true).length,
      });
    });
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-3xl font-bold p-4'>الموظفين</h1>
        <Button>
          <Link href="/employees/create">إضافة موظف جديد</Link>
        </Button>
      </div>
      <FilterableTable
        data={processedEmployees}
        columns={columns}
        basePath="/employees"
        filename="employees.csv"
        searchKeys={['firstName', 'lastName', 'email']}
        searchPlaceholder="ابحث بالاسم أو البريد"
        filters={[
          {
            key: 'onShiftLabel',
            label: 'حالة الدوام',
            options: [
              { label: 'في الدوام الآن', value: 'نعم' },
              { label: 'خارج الدوام', value: 'لا' },
            ],
          },
          {
            key: 'role',
            label: 'الدور الوظيفي',
            options: [
              { label: 'مدير', value: userRoles.ADMIN },
              { label: 'موظف', value: userRoles.EMPLOYEE },
              { label: 'مخزن', value: userRoles.WAREHOUSE },
            ],
          },
        ]}
        exportColumns={[
          { key: 'firstName', header: 'الاسم الأول' },
          { key: 'lastName', header: 'الاسم الأخير' },
          { key: 'email', header: 'البريد الإلكتروني' },
          { key: 'phoneNumber', header: 'رقم الهاتف' },
          { key: 'role', header: 'الدور' },
          { key: 'onShiftLabel', header: 'في الدوام' },
          { key: 'visitCount', header: 'عدد الزيارات' },
        ]}
      />
    </div>
  )
}

export default UsersPage
