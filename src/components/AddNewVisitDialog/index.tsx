'use client';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,}  from "@/components/ui/command"
import {Popover,PopoverContent,PopoverTrigger,} from "@/components/ui/popover"

type Hospital = {
  _id: string;
  name: string;
};

const AddNewVisitDialog = ({userToken, shiftId}: {userToken: string; shiftId: string}) => {
  // State for controlled inputs
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [open, setOpen] = useState(false) // Changed from true to false
  const [value, setValue] = useState("")
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

  useEffect(() => {
    fetch('/api/hospitals/get-hospitals', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    })
      .then(response => response.json())
      .then(data => {

        console.log(data)
        if (data.hospitals && data.hospitals.length > 0) {
          setHospitals(data.hospitals)
        }
      })
      .catch(error => console.error('Error fetching hospitals:', error));
  }, [])


  const handleAddNewVisit = async () => {
    const res = await fetch('/api/visit/create', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        hospitalId: value,
        shiftId,
        location,
      }),
    });
    const data = await res.json();

    if (res.status === 201) {
      router.push(`/visits/${data.visit._id}`)
    } else {
      console.log('error', data.message);
    }

  }
  
  console.log({
    shiftId,
    location,
    value,
  })
  return (
    <Dialog>
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