'use client';
import React, { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,}  from "@/components/ui/command"
import {Popover,PopoverContent,PopoverTrigger,} from "@/components/ui/popover"
import { toast } from 'sonner';
import { warnOnFence } from '@/utils/geo/fenceToast';

type Hospital = {
  _id: string;
  name: string;
};

const AddNewVisitDialog = ({userToken, shiftId}: {userToken: string; shiftId: string}) => {
  // State for controlled inputs
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [open, setOpen] = useState(false) // Changed from true to false
  // Controlled so a successful save can close the dialog itself, instead of
  // leaving it open with its button stuck on "جاري الحفظ...".
  const [dialogOpen, setDialogOpen] = useState(false)
  const [value, setValue] = useState("")
  const [startLocation, setStartLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = isLoading || isPending
  const router = useRouter()

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStartLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
      );
    }
  }, []);

  useEffect(() => {
    // Only hospitals assigned to this employee may be visited.
    fetch('/api/hospitals/assigned', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    })
      .then(response => response.json())
      .then(data => {

        if (data.hospitals && data.hospitals.length > 0) {
          setHospitals(data.hospitals)
        }
      })
      .catch(error => console.error('Error fetching hospitals:', error));
  }, [userToken])


  const handleAddNewVisit = async () => {
    if (!value) {
      toast.error('الرجاء اختيار المستشفى');
      return;
    }
    if (!startLocation) {
      toast.error('تعذّر تحديد موقعك. الرجاء السماح بالوصول إلى الموقع والمحاولة مرة أخرى.');
      return;
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/visit/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          hospitalId: value,
          shiftId,
          startLocation,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 201 && data.visit?._id) {
        toast.success('تمت إضافة الزيارة بنجاح!');
        warnOnFence(data.visit?.startFenceStatus, data.visit?.startDistanceMeters, 'visit');
        setDialogOpen(false)
        startTransition(() => router.push(`/visits/${data.visit._id}`))
      } else if (res.status === 409 && data.visit?._id) {
        // An open visit already exists — take the employee to it rather than
        // leaving them to create a duplicate.
        toast.info(data.message || 'لديك زيارة مفتوحة بالفعل.');
        setDialogOpen(false)
        startTransition(() => router.push(`/visits/${data.visit._id}`))
      } else {
        toast.error(data.message || 'حدث خطأ ما أثناء إضافة الزيارة. الرجاء المحاولة مرة أخرى.');
      }
    } catch {
      toast.error('حدث خطأ ما أثناء إضافة الزيارة. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="space-x-10 py-7 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500">
          <span className="text-lg">أبدأ زيارة جديدة</span>
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-md" 
        onInteractOutside={(e) => {
        e.preventDefault()
      }}
      >
        <DialogHeader>
          <DialogTitle>اضف زيارة جديدة</DialogTitle>
          <DialogDescription>قم باختيار المستشفى</DialogDescription>
        </DialogHeader>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {value
                ? hospitals?.find((hospital) => hospital._id === value)?.name
                : "اختر المستشفى..."}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent 
            className="w-full p-0 z-50" 
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder="ابحث عن المستشفى..." className="h-9" />
              <CommandList className="z-50">
                <CommandEmpty>No hospital found.</CommandEmpty>
                <CommandGroup>
                  {hospitals?.map((hospital) => (
                    <CommandItem
                      key={hospital?._id}
                      value={hospital?.name}
                      onSelect={() => {
                        setValue(hospital._id)
                        setOpen(false)
                      }}
                      className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === hospital?._id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {hospital?.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <DialogFooter className="sm:justify-start">
          <Button type="button" className='bg-[#5570F1] hover:bg-[#5570F1]' onClick={handleAddNewVisit} disabled={busy}>
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

export default AddNewVisitDialog;