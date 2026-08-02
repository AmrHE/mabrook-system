/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import React, { useEffect, useState, useTransition } from 'react'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { Input } from '../ui/input'
import { useParams, useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { userRoles } from '@/models/enum.constants';
import { toast } from 'sonner';
import HospitalMultiSelect from '../HospitalMultiSelect';
import IdentityImageUpload from '../IdentityImageUpload';

/** assignedHospitals may arrive populated ({_id,...}) or as raw id strings. */
const toHospitalIds = (list: any): string[] =>
  (list || []).map((h: any) => (typeof h === 'string' ? h : h?._id)).filter(Boolean);

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
  const [salary, setSalary] = useState<number|null>(null)
  const [iban, setIban] = useState<string|null>(null)
  const [bankName, setBankName] = useState<string|null>(null)
  const [identityNumber, setIdentityNumber] = useState<string|null>(null)
  const [identityImage, setIdentityImage] = useState<string|null>(null)
  const [assignedHospitals, setAssignedHospitals] = useState<string[]>([])
  const [project, setProject] = useState<string>('mabrook')
  const [projects, setProjects] = useState<string[]>(['mabrook'])
  const [responseMessage, setResponseMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = isLoading || isPending
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.projects) && d.projects.length) {
          setProjects(d.projects);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if(employee) {
      setFirstName(employee.user.firstName);
      setLastName(employee.user.lastName);
      setPhoneNumber(employee.user.phoneNumber);
      setEmail(employee.user.email);
      setUserRole(employee.user.role);
      setPassword(employee.user.passwordHash);
      setSalary(employee.user.salary ?? null);
      setIban(employee.user.iban ?? null);
      setBankName(employee.user.bankName ?? null);
      setIdentityNumber(employee.user.identityNumber ?? null);
      setIdentityImage(employee.user.identityImage ?? null);
      setAssignedHospitals(toHospitalIds(employee.user.assignedHospitals));
      setProject(employee.user.project ?? 'mabrook');
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
      setSalary(updatedUser.salary ?? null);
      setIban(updatedUser.iban ?? null);
      setBankName(updatedUser.bankName ?? null);
      setIdentityNumber(updatedUser.identityNumber ?? null);
      setIdentityImage(updatedUser.identityImage ?? null);
      setAssignedHospitals(toHospitalIds(updatedUser.assignedHospitals));
      setProject(updatedUser.project ?? 'mabrook');
    }
  }, [updatedUser]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true)
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
          password,
          salary,
          iban,
          bankName,
          identityNumber,
          identityImage,
          assignedHospitals,
          project,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Without this return the success toast fired on failure too.
        toast.error(data?.message || 'حدث خطأ ما أثناء تعديل الموظف. الرجاء المحاولة مرة أخرى.');
        return;
      }
      setUpdatedUser(data.user);
      toast.success('تمت تعديل الموظف بنجاح!');
      setResponseMessage('تم حفظ التعديلات');
      // Already on /employees/[id] — refresh, don't push to the current route.
      startTransition(() => router.refresh());
    } catch (error: any) {
      toast.error('حدث خطأ ما أثناء تعديل الموظف. الرجاء المحاولة مرة أخرى.');
      setResponseMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false)
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

      <Label htmlFor="role">
        الدور الوظيفي
      </Label>
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

      <Label htmlFor="project">
        المشروع
      </Label>
      <Select
        value={project}
        onValueChange={(value: string) => setProject(value)}
      >
        <SelectTrigger id="project">
          <SelectValue placeholder="اختر المشروع" />
        </SelectTrigger>
        <SelectContent>
          {[...new Set([project, ...projects])].filter(Boolean).map((p) => (
            <SelectItem key={p} value={p}>
              {p}
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

      <Label htmlFor="salary">
        الراتب
      </Label>
      <Input
        type='number'
        placeholder="الراتب"
        id="salary"
        value={salary ?? ''}
        onChange={(e) => setSalary(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label>
        المستشفيات المعيّنة
      </Label>
      <HospitalMultiSelect userToken={userToken} value={assignedHospitals} onChange={setAssignedHospitals} />

      <Label htmlFor="iban">
        رقم الآيبان (IBAN)
      </Label>
      <Input
        placeholder="رقم الآيبان"
        id="iban"
        value={iban ?? ''}
        onChange={(e) => setIban(e.target.value)}
      />

      <Label htmlFor="bankName">
        اسم البنك
      </Label>
      <Input
        placeholder="اسم البنك"
        id="bankName"
        value={bankName ?? ''}
        onChange={(e) => setBankName(e.target.value)}
      />

      <Label htmlFor="identityNumber">
        رقم الهوية
      </Label>
      <Input
        placeholder="رقم الهوية"
        id="identityNumber"
        value={identityNumber ?? ''}
        onChange={(e) => setIdentityNumber(e.target.value)}
      />

      <Label>
        صورة الهوية
      </Label>
      <IdentityImageUpload value={identityImage} onChange={setIdentityImage} />

      <div className='flex items-center justify-center w-full mt-4'>
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit' disabled={busy}>
          { busy ? 'جاري الحفظ...' : 'حفظ التعديلات' }
        </Button>
      </div>
    </form>
  )
}

export default EditEmployeeForm