'use client';
import CallToActionCard from '@/components/CallToActionCard';
import hand from '../../../../public/hand.svg';
import { Plus, ArrowLeftFromLine, CornerDownLeft, MapPin, Clock, RotateCcw, History, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AddNewVisitDialog from '@/components/AddNewVisitDialog';
import LocationModal from '@/components/LocationModal';
import StartShiftDialog from '@/components/StartShiftDialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CurrentState } from '@/utils/shift/currentState';
import { formatSessionSpan } from '@/utils/shift/labels';

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

/** Human-readable elapsed time from a minute count. */
function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(m / 60)} س ${m % 60} د`;
}

const clockTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Riyadh',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function EmployeeDashboard({
  userToken,
  initialState,
}: {
  userToken: string | undefined;
  initialState: CurrentState;
}) {
  const [state, setState] = useState<CurrentState>(initialState);
  const [busy, setBusy] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const busyRef = useRef(false);
  const router = useRouter();

  const { shift, resumableShift, staleOpenShift, openVisit, resumableVisits } = state;

  /**
   * Resync from the database. Called after every mutation and whenever the tab
   * wakes up — this, rather than a cookie, is what makes the dashboard survive
   * a browser restart or a phone going to sleep mid-shift.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/shift/current-state', {
        headers: userToken ? { authorization: `Bearer ${userToken}` } : undefined,
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.state) setState(data.state);
    } catch {
      // A failed resync just leaves the last known state on screen.
    }
  }, [userToken]);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [refresh]);

  // Live counter (set after mount to avoid a hydration mismatch).
  useEffect(() => {
    if (!shift) {
      setNowTs(null);
      return;
    }
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [shift]);

  const handleCta = async () => {
    if (!shift) {
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
      if (!res.ok) toast.error('تعذّر إنهاء الدوام. حاول مرة أخرى.');
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const resumeVisit = async (visitId: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const location = await captureLocation();
      const res = await fetch(`/api/visit/resume/${visitId}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ startLocation: location }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'تعذّر متابعة الزيارة.');
        await refresh();
        return;
      }
      router.push(`/visits/${visitId}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Worked time = closed sessions + the running one. Measuring the span from the
  // day's first check-in would silently bill the breaks between sessions.
  const liveMinutes =
    shift && nowTs
      ? (shift.workedMinutes ?? 0) +
        (shift.currentSegmentStartedAt
          ? Math.max(0, (nowTs - new Date(shift.currentSegmentStartedAt).getTime()) / 60000)
          : 0)
      : shift?.workedMinutes ?? 0;

  const sessionMinutes =
    shift && nowTs && shift.currentSegmentStartedAt
      ? Math.max(0, (nowTs - new Date(shift.currentSegmentStartedAt).getTime()) / 60000)
      : 0;

  // The day's first check-in, matching the tile's label. Per-session
  // coordinates live on the segments and are surfaced in the admin reports.
  const startLoc = shift?.startLocation;
  const hasLoc = startLoc && Number.isFinite(startLoc.lat) && Number.isFinite(startLoc.lng);

  const cta = busy
    ? shift
      ? 'جاري إنهاء الدوام...'
      : 'جاري التحميل...'
    : shift
    ? 'إنهاء الدوام'
    : resumableShift
    ? 'استئناف الدوام'
    : 'بدأ الدوام';

  const CtaIcon = shift ? ArrowLeftFromLine : resumableShift ? RotateCcw : Plus;

  const ctaText = shift
    ? 'لا تنسى ضغط زر انهاء الدوام عند انتهاء ساعات العمل'
    : resumableShift
    ? `لقد أنهيت دوامك اليوم الساعة ${clockTime(resumableShift.endTime)}. يمكنك استئناف نفس اليوم دون فتح وردية جديدة.`
    : 'من فضلك قم بالضغط على بدأ الدوام ثم قم بادخال الزيارة';

  return (
    <div className="space-y-4">
      <CallToActionCard
        cta={cta}
        CtaIcon={CtaIcon}
        text={ctaText}
        title="اهلا بك في حملة مبروك!"
        icon={hand}
        action={handleCta}
      />

      {staleOpenShift && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="size-5 shrink-0" />
          <p>
            لديك دوام مفتوح من يوم {staleOpenShift.dayKey} — سيتم إغلاقه تلقائياً عند آخر نشاط مسجل.
          </p>
        </div>
      )}

      {userToken && (
        <StartShiftDialog
          userToken={userToken}
          open={startOpen}
          onOpenChange={setStartOpen}
          mode={resumableShift ? 'resume' : 'start'}
          resumableShift={resumableShift}
          onStarted={refresh}
        />
      )}

      {/* Closed for now, but the day is still open for more sessions. Without
          this card the screen goes blank after checking out, which is exactly
          where employees used to assume their shift had been lost. */}
      {!shift && resumableShift && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border-t border-solid border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 text-gray-600">
            <History className="size-4" />
            <span className="font-medium">دوام اليوم</span>
          </div>
          <span>{resumableShift.sessionsCount} جلسات</span>
          <span>{formatMinutes(resumableShift.workedMinutes)}</span>
          <span className="text-gray-500">آخر انصراف {clockTime(resumableShift.endTime)}</span>
          <span className="text-gray-400 text-sm">
            {resumableShift.segments.map((s) => formatSessionSpan(s.startTime, s.endTime)).join(' · ')}
          </span>
        </div>
      )}

      {shift && (
        <div className="flex items-start lg:items-center flex-col lg:flex-row gap-10 justify-between bg-white rounded-xl p-10 border-t border-solid border-gray-200">
          <div className="flex items-start lg:items-center flex-col lg:flex-row lg:px-10 gap-8 divide-gray-300">
            <div className="space-y-4 text-center">
              <p className="text-gray-500">أول تسجيل دخول اليوم</p>
              <h1 className="font-medium text-xl">
                {new Date(shift.startTime).toLocaleString("en-SA", {
                timeZone: "Asia/Riyadh",
                dateStyle: "medium",
                timeStyle: "short",
              })}
              </h1>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-gray-500 flex items-center justify-center gap-1"><Clock className="size-4" /> إجمالي اليوم</p>
              <h1 className="font-medium text-xl">
                {nowTs ? formatMinutes(liveMinutes) : "—"}
              </h1>
            </div>

            {shift.sessionsCount > 1 && (
              <div className="space-y-4 text-center">
                <p className="text-gray-500">الجلسة الحالية</p>
                <h1 className="font-medium text-xl">
                  {nowTs ? formatMinutes(sessionMinutes) : "—"}
                  <span className="text-gray-400 text-sm block">
                    الجلسة رقم {shift.sessionsCount}
                  </span>
                </h1>
              </div>
            )}

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

          <div className="flex flex-col gap-3">
            {openVisit ? (
              <Button
                size="lg"
                className="space-x-10 py-7 bg-[#5570F1] hover:bg-[#3250e9] transition-all duration-500"
                onClick={() => router.push(`/visits/${openVisit._id}`)}
              >
                <span className="text-lg">
                  متابعة الزيارة{openVisit.hospitalName ? ` — ${openVisit.hospitalName}` : ''}
                </span>
                <CornerDownLeft />
              </Button>
            ) : (
              <>
                {userToken && <AddNewVisitDialog userToken={userToken} shiftId={shift._id} />}
                {resumableVisits.map((v) => (
                  <Button
                    key={v._id}
                    variant="secondary"
                    disabled={busy}
                    className="border-2 bg-white text-[#5570F1] border-solid border-[#5570F1]"
                    onClick={() => resumeVisit(v._id)}
                  >
                    <RotateCcw className="size-4" />
                    <span>
                      متابعة زيارة {v.hospitalName ?? ''} ({clockTime(v.endTime)})
                    </span>
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
