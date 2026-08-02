'use client';
import React, { useState, useTransition } from 'react';
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
import EmployeeMultiSelect from '@/components/EmployeeMultiSelect';

// Leaflet must never run on the server.
const HospitalLocationPicker = dynamic(() => import('@/components/HospitalLocationPicker'), { ssr: false });

const AddNewHospitalDialog = ({userToken, isAdmin}: {userToken: string | undefined; isAdmin?: boolean}) => {
  // State for controlled inputs
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  // Admin-only and optional. An employee is always assigned to what they create,
  // so the picker would be meaningless for them.
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = isLoading || isPending
  // Controlled so a successful save can close the dialog itself — it used to
  // stay open behind the new page with its button still saying "جاري الحفظ...".
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleAddNewHospital = async () => {
    setIsLoading(true)
    try {
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
          employeeIds,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status !== 201 || !data?.hospital?._id) {
        toast.error(data?.message || 'حدث خطأ ما أثناء إضافة المستشفى. الرجاء المحاولة مرة أخرى.');
        return;
      }
      toast.success('تمت إضافة المستشفى بنجاح!');
      setOpen(false)
      startTransition(() => router.push(`/hospitals/${data.hospital._id}`))
    } catch {
      toast.error('حدث خطأ ما أثناء إضافة المستشفى. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

          {/* Employees are assigned to their own hospital automatically, so this
              picker is only meaningful — and only permitted — for admins. */}
          {isAdmin && (
            <>
              <Label className="mt-2 text-sm text-gray-600">الموظفون المعينون (اختياري)</Label>
              <EmployeeMultiSelect userToken={userToken} value={employeeIds} onChange={setEmployeeIds} />
              <p className="text-xs text-gray-400">
                يمكنك تركها فارغة الآن وتعيين الموظفين لاحقًا من صفحة المستشفى.
              </p>
            </>
          )}
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" className='bg-[#5570F1] hover:bg-[#5570F1]' onClick={handleAddNewHospital} disabled={busy}>
            {busy ? 'جاري الحفظ...' : 'حفظ'}
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
