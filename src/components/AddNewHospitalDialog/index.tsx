'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

const AddNewHospitalDialog = ({userToken}: {userToken: string | undefined}) => {
  // State for controlled inputs
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleAddNewHospital = async () => {
    setIsLoading(true)
    const res = await fetch('/api/hospitals/create', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: hospitalName,
        district,
        city,
      }),
    });
    const data = await res.json();

    if (res.status === 201) {
      alert('تمت إضافة المستشفى بنجاح!');
      router.push(`/hospitals/${data.hospital._id}`)
    } else {
      alert('حدث خطأ ما أثناء إضافة المستشفى. الرجاء المحاولة مرة أخرى.');
      setIsLoading(false);
      console.log('error', data.message);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="space-x-5 py-6"
        >
          <span className="text-lg">اضافة مستشفى</span>
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>اضف مستشفى جديدة</DialogTitle>
          <DialogDescription>قم بأدخال بيانات المستشفى</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="hospitalName" className="sr-only">
            اسم المستشفى
          </Label>
          <Input
            placeholder="اسم المستشفى"
            id="hospitalName"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
          />

          <Label htmlFor="city" className="sr-only">
            المدينة
          </Label>
          <Input
            placeholder="المدينة"
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <Label htmlFor="district" className="sr-only">
            الحي/المنطقة
          </Label>
          <Input
            placeholder="الحي/المنطقة"
            id="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" className='bg-[#5570F1] hover:bg-[#5570F1]' onClick={handleAddNewHospital} disabled={isLoading}>
            {isLoading ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary" className='border-2 bg-white text-[#5570F1] border-solid border-[#5570F1]'>
              اغلاق
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddNewHospitalDialog;
