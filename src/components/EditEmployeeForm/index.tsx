/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import React, { useEffect, useState } from 'react'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { Input } from '../ui/input'
import { useParams, useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { userRoles } from '@/models/enum.constants';


const EditEmployeeForm = ({userToken, employee}: {userToken: string | undefined, employee: any}) => {
  const params = useParams();
  const userId = params.id as string;
  const [firstName, setFirstName] = useState<string|null>(null)
  const [lastName, setLastName] = useState<string|null>(null)
  const [phoneNumber, setPhoneNumber] = useState<string|null>(null)
  const [email, setEmail] = useState<string|null>(null)
  const [password, setPassword] = useState<string|null>(null)
  const [updatedUser, setUpdatedUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<userRoles | null>(null)
  const [responseMessage, setResponseMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter();


  useEffect(() => {
    if(employee) {
      setFirstName(employee.user.firstName);
      setLastName(employee.user.lastName);
      setPhoneNumber(employee.user.phoneNumber);
      setEmail(employee.user.email);
      setUserRole(employee.user.role);
      setPassword(employee.user.passwordHash);
    }
  }, [employee]);
  
  useEffect(() => {
    if(updatedUser) {
      setFirstName(updatedUser.firstName);
      setLastName(updatedUser.lastName);
      setPhoneNumber(updatedUser.phoneNumber);
      setEmail(updatedUser.email);
      setUserRole(updatedUser.role);
      setPassword(updatedUser.passwordHash);
    }
  }, [updatedUser]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true)
    e.preventDefault();
    try {
      const res = await fetch(`/api/user/update-user/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber,
          email,
          userRole,
          password
        }),
      });

      const data = await res.json();
      setUpdatedUser(data.user);

      if (!res.ok) {
        alert('حدث خطأ ما أثناء تعديل الموظف. الرجاء المحاولة مرة أخرى.');
        setIsLoading(false)
      }
      alert('تمت تعديل الموظف بنجاح!');
      setResponseMessage('Mom submitted successfully!');      
      router.push(`/employees/${userId}`);
      
    } catch (error: any) {
      setResponseMessage(`Error: ${error.message}`);
    }
  };

  return (
    <form className='flex flex-col gap-5 lg:max-w-1/3 mt-10' onSubmit={handleSubmit}>
      <Label htmlFor="firstName">
        الاسم الاول
      </Label>
      <Input
        placeholder="اسم الاول"
        id="firstName"
        required
        value={firstName? firstName : ''}
        onChange={(e) => setFirstName(e.target.value)}
      />

      <Label htmlFor="lastName">
        الاسم الاخير
      </Label>
      <Input
        placeholder="اسم العائلة"
        id="lastName"
        required
        value={lastName? lastName : ''}
        onChange={(e) => setLastName(e.target.value)}
      />

      <Label htmlFor="phoneNumber">
        رقم الهاتف
      </Label>
      <Input
        placeholder="رقم الهاتف"
        id="phoneNumber"
        required
        value={phoneNumber? phoneNumber : ''}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />

      <Label htmlFor="email">
        البريد الإلكتروني
      </Label>
      <Input
        placeholder="البريد الإلكتروني"
        id="email"
        required
        value={email? email : ''}
        onChange={(e) => setEmail(e.target.value)}
      />

        <Select
          value={userRole ? userRole : ""}
          onValueChange={(value: userRoles) => setUserRole(value as userRoles)}
        >
          <SelectTrigger id="role">
            <SelectValue placeholder="اختر الدور" />{/** TODO: fix this default value to make the correct value appear when we get the employee document */}
          </SelectTrigger>
          <SelectContent>
            {Object.values(userRoles).map((role) => (
              <SelectItem key={role} value={role}>
                {role === userRoles.EMPLOYEE
                  ? "موظف"
                  : role === userRoles.ADMIN
                  ? "مدير"
                  : role === userRoles.WAREHOUSE
                  ? "مسؤول المخزن"
                  : role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      <Label htmlFor="password">
        كلمة المرور
      </Label>
      <Input
        placeholder="كلمة المرور"
        id="password"
        value={password? password : ''}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className='flex items-center justify-center w-full mt-4'>
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit' disabled={isLoading}>
          { isLoading ? 'جاري الحفظ...' : 'حفظ التعديلات' }
        </Button>
      </div>
    </form>
  )
}

export default EditEmployeeForm