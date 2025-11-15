export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies, headers } from 'next/headers';
import React from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import EditEmployeeForm from '@/components/EditEmployeeForm';
import DeleteEmployeeButton from '@/components/DeleteEmployeeButton';
import { userRoles } from '@/models/enum.constants';

async function getdEmployeeData(id: string, userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

  const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/user/get-user/${id}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${userToken}`,
    },
  });
  return res.json();
}


const SingledEmployeePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const userRole = cookieStore.get('role')?.value;
  const employee = await getdEmployeeData(id, userToken);

  return (
    <div className='p-5 w-full min-h-[92vh] bg-white rounded-3xl overflow-hidden'>
      {employee && (
        <div className='flex items-center justify-between p-4 rounded-3xl mb-10'>
          <h1 className='text-gray-800 font-bold text-3xl mb-10'>تفاصيل الموظف</h1>

          {userRole === userRoles.ADMIN && (
            <DeleteEmployeeButton id={id} userToken={userToken!} />
          )}
        </div>
      )}

      <Tabs dir='rtl' defaultValue="employeeDetails" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="employeeDetails" className='cursor-pointer'>بيانات الموظف</TabsTrigger>
        <TabsTrigger value="editEmployee" className='cursor-pointer'>تعديل البيانات</TabsTrigger>
      </TabsList>
      <TabsContent value="employeeDetails">
        <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>بيانات الموظف</h4>
        <div className='flex max-w-[400px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>الاسم الاول</p>
            <p>الاسم الاخير</p>
            <p>البريد الإلكتروني</p>
            <p>رقم الهاتف</p>
            <p>الدور الوظيفي</p>
            <p>كلمة المرور</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>{employee.user.firstName}</p>
            <p>{employee.user.lastName}</p>
            <p>{employee.user.email}</p>
            <p>{employee.user.phoneNumber}</p>
            <p>{employee.user.role}</p>
            <p>{employee.user.passwordHash}</p>
          </div>
        </div>

        <h4 className='mt-12 mb-4 font-semibold text-gray-700 text-xl'>بيانات التسجيل</h4>
        <div className='flex max-w-[320px] justify-between'>
          <div className='flex flex-col gap-5'>
            <p>تاريخ إنشاء الحساب</p>
            <p>اخر تعديل</p>
            <p>اخر تسجيل دخول</p>
            <p>عدد الزيارات المسجلة</p>
            <p>عدد الدوامات المسجلة</p>
          </div>
          <div className='flex flex-col gap-5'>
            <p>
              {new Date(employee.user.createdAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p>{new Date(employee.user.updatedAt).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
            <p>{new Date(employee.user.lastLogin).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}</p>
            <p>{employee.user.visits.filter((visit: { isActive: boolean; }) => visit.isActive === true).length}</p>
            <p>{employee.user.shifts.length}</p>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="editEmployee">
        <EditEmployeeForm userToken={userToken} employee={employee} />
      </TabsContent>
    </Tabs>
    </div>
  )
}

export default SingledEmployeePage