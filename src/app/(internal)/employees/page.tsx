/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import { columns } from "./columns";
import { ClientDataTable } from './client-data-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
} //TODO: ADD IN SHIFT BOOLEAN VARIABLE TO THE EMPLOYEE IN THE FRONTEND AND THE DATABASE IF NEEDED SO THE ADMIN CAN SEE IF THE EMPLOYEE IS ON SHIFT OR NOT


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
      });
    });
  }

  return (
    <div>
      <div className='flex items-center justify-between p-4 rounded-3xl mb-10'>
        <h1 className='text-3xl font-bold p-4'>الموظفين</h1>
        <Button>
          <Link href="/employees/create">إضافة موظف جديد</Link>
        </Button>
      </div>
      <ClientDataTable columns={columns} data={processedEmployees} />
    </div>
  )
}

export default UsersPage