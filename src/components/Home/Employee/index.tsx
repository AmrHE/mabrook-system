'use client';
import CallToActionCard from '@/components/CallToActionCard';
import hand from '../../../../public/hand.svg';
import { shiftStatus } from '@/models/enum.constants';
import { Plus, ArrowLeftFromLine, CornerDownLeft, MapPin, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ShiftType } from '@/types/types';
import AddNewVisitDialog from '@/components/AddNewVisitDialog';
import LocationModal from '@/components/LocationModal';
import StartShiftDialog from '@/components/StartShiftDialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/** Best-effort geolocation capture — resolves null on denial/timeout/unsupported (never rejects). */
function captureLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/** Human-readable elapsed time since a start timestamp. */
function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} س ${m} د`;
}

export default function EmployeeDashboard({userToken, currentShift, visitStatus, currentVisit}: {userToken: string | undefined; currentShift: string | undefined; visitStatus: string | undefined, currentVisit: string | undefined}) {
  const [shift, setShift] = useState<ShiftType | null>(null);
  const [busy, setBusy] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const busyRef = useRef(false);
  const currentShiftStatus = shift?.status || currentShift;
  const router = useRouter();

  // Starting a shift opens the hospital-picker dialog; ending happens inline.
  const handleClick = async () => {
    if (currentShiftStatus !== shiftStatus.IN_PROGRESS) {
      setStartOpen(true);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const location = await captureLocation();
      if (!location) {
        toast.error('تعذّر تحديد موقعك. فعّل إذن الموقع في المتصفح لتسجيل موقع الدوام.');
      }
      const res = await fetch('/api/shift/endShift', {
        method: 'POST',
        headers: { authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ location }),
      });
      const data = await res.json();
      // The ended shift (status ENDED) hides the panel and flips the button to "start".
      setShift(data.shift);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!shift && currentShiftStatus === shiftStatus.IN_PROGRESS) {
      const getCurrentShift = async () => {
        const res = await fetch('/api/shift/getCurrentShift', {
          method: 'GET',
          headers: {
            authorization: `Bearer ${userToken}`,
          },
        });
        const data = await res.json();
        setShift(data.shift);
      };
      getCurrentShift();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Running elapsed timer while a shift is open (set after mount to avoid hydration mismatch).
  useEffect(() => {
    if (currentShiftStatus !== shiftStatus.IN_PROGRESS || !shift) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [currentShiftStatus, shift]);

  const startLoc = shift?.startLocation;
  const hasLoc = startLoc && Number.isFinite(startLoc.lat) && Number.isFinite(startLoc.lng);

  return (
    <div>
      <CallToActionCard
        cta={
          busy
            ? '...جاري'
            : currentShiftStatus !== shiftStatus.IN_PROGRESS
            ? 'بدأ الدوام'
            : 'إنهاء الدوام'
        }
        CtaIcon={
          currentShiftStatus !== shiftStatus.IN_PROGRESS
            ? Plus
            : ArrowLeftFromLine
        }
        text={
          currentShiftStatus !== shiftStatus.IN_PROGRESS
            ? 'من فضلك قم بالضغط على بدأ الدوام ثم قم بادخال الزيارة'
            : 'لا تنسى ضغط زر انهاء الدوام عند انتهاء ساعات العمل'
        }
        title="اهلا بك في حملة مبروك!"
        icon={hand}
        action={handleClick}
      />

      {userToken && (
        <StartShiftDialog
          userToken={userToken}
          open={startOpen}
          onOpenChange={setStartOpen}
          onStarted={(s) => setShift(s)}
        />
      )}

      {shift && currentShiftStatus === shiftStatus.IN_PROGRESS && (
        <div className="flex items-start lg:items-center flex-col lg:flex-row gap-10 justify-between bg-white rounded-xl p-10 border-t border-solid border-gray-200">
          <div className="flex items-start lg:items-center flex-col lg:flex-row lg:px-10 gap-8 divide-gray-300">
            <div className="space-y-4 text-center">
              <p className="text-gray-500">توقيت بدأ الدوام</p>
              <h1 className="font-medium text-xl">
                {new Date(shift.startTime).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}
              </h1>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-gray-500 flex items-center justify-center gap-1"><Clock className="size-4" /> مدة الدوام</p>
              <h1 className="font-medium text-xl">
                {nowTs ? formatElapsed(nowTs - new Date(shift.startTime).getTime()) : "—"}
              </h1>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-gray-500 flex items-center justify-center gap-1"><MapPin className="size-4" /> موقع بدء الدوام</p>
              {hasLoc ? (
                <div className="font-medium">
                  <LocationModal
                    start={startLoc}
                    end={shift.endLocation}
                    triggerText={`${startLoc!.lat!.toFixed(5)}, ${startLoc!.lng!.toFixed(5)}`}
                  />
                </div>
              ) : (
                <p className="font-medium text-gray-400 text-sm">تعذّر تحديد الموقع</p>
              )}
            </div>
          </div>

          {userToken && visitStatus !== shiftStatus.IN_PROGRESS ? (
            <AddNewVisitDialog userToken={userToken} shiftId={shift._id} />
          ) : (
            <Button size="lg" className="space-x-10 py-7 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500" onClick={() => router.push(`/visits/${currentVisit}`)}>
              <span className="text-lg">اذهب إلى الزيارة</span>
              <CornerDownLeft />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
