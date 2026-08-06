"use client"
import React, { useState } from 'react'
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { warnOnFence } from '@/utils/geo/fenceToast';

/**
 * Reopen an ended visit as a new session.
 *
 * The server decides whether it is allowed (same employee, today's open shift,
 * no other open visit, and within the inactivity window) and returns an Arabic
 * reason when it is not — so this button can always be offered and the
 * explanation stays in one place.
 */
const ResumeVisitButton = ({ id, userToken }: { id: string; userToken: string | undefined }) => {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter();

  /** Best-effort: a missing fix must not block resuming, only lose the coordinates. */
  function getStartLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }

  async function resumeVisit() {
    setIsLoading(true)
    try {
      const startLocation = await getStartLocation();
      const res = await fetch(`/api/visit/resume/${id}`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ startLocation }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'تعذّر متابعة الزيارة.');
        return;
      }
      toast.success('تم استئناف الزيارة.');
      // Warn on the session just opened, not the visit: the visit's fence fields
      // describe the original check-in, which on a resume is hours old.
      warnOnFence(data.segment?.startFenceStatus, data.segment?.startDistanceMeters, 'visit');
      router.refresh();
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      size="lg"
      variant="secondary"
      className='py-5 border-2 bg-white text-[#5570F1] border-solid border-[#5570F1]'
      onClick={resumeVisit}
      disabled={isLoading}
    >
      <RotateCcw className="size-4" />
      <span className='text-lg'>
        {isLoading ? 'جاري المتابعة...' : 'متابعة الزيارة'}
      </span>
    </Button>
  )
}

export default ResumeVisitButton
