'use client';
import React, { useEffect, useState } from 'react';
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

const AddNewVisitDialog = ({userToken, shiftId}: {userToken: string; shiftId: string}) => {
  // State for controlled inputs
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const router = useRouter()

  useEffect(() => {
    if ('geolocation' in navigator) {
      console.log('Geolocation is available');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
      );
    }
  }, []);

  const handleAddNewVisit = async () => {
    const res = await fetch('/api/visit/create', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: hospitalName,
        district,
        city,
        shiftId,
        location,
      }),
    });
    const data = await res.json();

    if (res.status === 201) {
      // console.log(data)
      router.push(`/visits/${data.visit._id}`)
    } else {
      console.log('error', data.message);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="space-x-10 py-7 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500"
        >
          <span className="text-lg">أبدأ زيارة جديدة</span>{/* TODO: add a checker here to see if there is an existing in progress visit so the call to action should be go to current visit if not then start new visit */}
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>اضف زيارة جديدة</DialogTitle>
          <DialogDescription>قم بأدخال بيانات المستشفى</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="hospitalName" className="sr-only">{/* TODO: add the option to select existing hospital or add new hospital and in the add new hospital part use the combobox shadcn component to select a current hospital */}
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
          <Button type="button" className='bg-[#5570F1] hover:bg-[#5570F1]' onClick={handleAddNewVisit}>
            حفظ
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

export default AddNewVisitDialog;
