 
"use client"
import React, { useState, useTransition } from 'react'
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const EndVisitButton = ({id, userToken} : {id: string | undefined, userToken: string | undefined}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = isLoading || isPending
  const router = useRouter();

  // Read a fresh GPS fix when ending the visit; endLocation is required.
  function getEndLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('no geolocation'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  async function endVisit() {
    setIsLoading(true)
    let endLocation: { lat: number; lng: number };
    try {
      endLocation = await getEndLocation();
    } catch {
      toast.error('تعذّر تحديد موقعك. الرجاء السماح بالوصول إلى الموقع والمحاولة مرة أخرى.');
      setIsLoading(false);
      return;
    }

    // A network failure here used to escape the handler, stranding the button
    // on "جاري الإنهاء..." with no way to retry.
    try {
      const res = await fetch(`/api/visit/end-visit/${id}`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ endLocation }),
      });
      if (!res.ok) {
        toast.error('حدث خطأ ما أثناء انهاء الزيارة. الرجاء المحاولة مرة أخرى.');
        return;
      }
      toast.success('تم انهاء الزيارة بنجاح!');
      startTransition(() => router.push(`/`))
    } catch {
      toast.error('حدث خطأ ما أثناء انهاء الزيارة. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <Button size="lg" className='py-5 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500' onClick={endVisit} disabled={busy}>
      <span className='text-lg'>
        {busy ? 'جاري الإنهاء...' : 'انهاء الزيارة'}
      </span>
    </Button>
  )
}

export default EndVisitButton