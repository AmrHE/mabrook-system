'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
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
import { toast } from 'sonner';
import type { LatLng } from '@/components/HospitalLocationPicker';
import LocationPicker from '@/components/LocationPicker';

// Leaflet must never run on the server.
const HospitalLocationPicker = dynamic(() => import('@/components/HospitalLocationPicker'), { ssr: false });

const AddNewHospitalDialog = ({userToken, isAdmin}: {userToken: string | undefined; isAdmin?: boolean}) => {
  // State for controlled inputs
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
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
        location: location ?? undefined,
      }),
    });
    const data = await res.json();

    if (res.status === 201) {
      toast.success('تمت إضافة المستشفى بنجاح!');
      router.push(`/hospitals/${data.hospital._id}`)
    } else {
      toast.error('حدث خطأ ما أثناء إضافة المستشفى. الرجاء المحاولة مرة أخرى.');
      toast.error(data.message);
      setIsLoading(false);
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
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        // Keep the dialog open when interacting with the city/district combobox,
        // whose Popover renders in a portal outside the dialog subtree.
        onInteractOutside={(e) => e.preventDefault()}
      >
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

          <LocationPicker
            city={city}
            district={district}
            onChange={({ city, district }) => {
              setCity(city);
              setDistrict(district);
            }}
            userToken={userToken}
            isAdmin={isAdmin}
          />

          <Label className="mt-2 text-sm text-gray-600">موقع المستشفى (لتقييد تسجيل الحضور)</Label>
          <HospitalLocationPicker value={location} onChange={setLocation} />
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
