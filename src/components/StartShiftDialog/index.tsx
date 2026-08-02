"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { warnOnFence } from "@/utils/geo/fenceToast";
import type { DayShiftDTO } from "@/utils/shift/currentState";

type AssignedHospital = { _id: string; name: string; location?: { lat?: number; lng?: number } };

/** Best-effort geolocation capture — resolves null on denial/timeout/unsupported. */
function captureLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
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

/**
 * Shift-start flow: pick one of the employee's ASSIGNED hospitals, capture GPS,
 * then start the shift. Soft geofence — a check-in is never blocked, only flagged.
 *
 * In `resume` mode the same endpoint appends a session to today's existing
 * shift instead of opening a new one, so an interrupted day stays a single
 * record. The hospital is pre-selected from that shift but stays changeable —
 * each session records its own.
 */
export default function StartShiftDialog({
  userToken,
  open,
  onOpenChange,
  onStarted,
  mode = "start",
  resumableShift,
}: {
  userToken: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStarted: () => void | Promise<void>;
  mode?: "start" | "resume";
  resumableShift?: DayShiftDTO | null;
}) {
  const [hospitals, setHospitals] = useState<AssignedHospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState("");
  const [busy, setBusy] = useState(false);

  const isResume = mode === "resume" && !!resumableShift;

  useEffect(() => {
    if (!open) return;
    setLoadingHospitals(true);
    fetch("/api/hospitals/assigned", { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => r.json())
      .then((data) => setHospitals(Array.isArray(data.hospitals) ? data.hospitals : []))
      .catch(() => setHospitals([]))
      .finally(() => setLoadingHospitals(false));
  }, [open, userToken]);

  // One-tap resume: default to the hospital the day was started at.
  useEffect(() => {
    if (open && isResume && resumableShift?.hospitalId) setHospitalId(resumableShift.hospitalId);
  }, [open, isResume, resumableShift?.hospitalId]);

  const hasHospitals = hospitals.length > 0;

  const start = async () => {
    if (hasHospitals && !hospitalId) {
      toast.error("الرجاء اختيار المستشفى");
      return;
    }
    setBusy(true);
    try {
      const location = await captureLocation();
      if (!location) toast.error("تعذّر تحديد موقعك. فعّل إذن الموقع لتسجيل موقع الدوام.");

      const res = await fetch("/api/shift/create", {
        method: "POST",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ location, hospitalId: hospitalId || undefined }),
      });
      const data = await res.json();
      if (data.shift) {
        // Warn on the segment just created, not on the shift: the shift's fence
        // fields describe the day's FIRST check-in, which on a resume is hours old.
        const seg = data.segment ?? data.shift;
        warnOnFence(seg.startFenceStatus, seg.startDistanceMeters);
        await onStarted();
        onOpenChange(false);
        setHospitalId("");
      } else {
        toast.error(data.message || "تعذّر بدء الدوام. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isResume ? "استئناف الدوام" : "بدء الدوام"}</DialogTitle>
          <DialogDescription>
            {isResume
              ? "اختر المستشفى الذي تستأنف الدوام فيه"
              : "اختر المستشفى الذي تبدأ الدوام فيه"}
          </DialogDescription>
        </DialogHeader>

        {isResume && (
          <p className="text-sm text-gray-500">
            سيتم إضافة جلسة جديدة إلى دوام اليوم (الجلسة رقم {(resumableShift?.sessionsCount ?? 0) + 1}).
          </p>
        )}

        {loadingHospitals ? (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <Loader2 className="size-4 animate-spin" /> جاري تحميل المستشفيات...
          </div>
        ) : hasHospitals ? (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={pickerOpen} className="w-full justify-between">
                {hospitalId ? hospitals.find((h) => h._id === hospitalId)?.name : "اختر المستشفى..."}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 z-50" align="start" side="bottom" sideOffset={4}>
              <Command>
                <CommandInput placeholder="ابحث عن المستشفى..." className="h-9" />
                <CommandList className="z-50">
                  <CommandEmpty>لا توجد مستشفى مطابقة.</CommandEmpty>
                  <CommandGroup>
                    {hospitals.map((h) => (
                      <CommandItem
                        key={h._id}
                        value={h.name}
                        onSelect={() => {
                          setHospitalId(h._id);
                          setPickerOpen(false);
                        }}
                        className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      >
                        <Check className={cn("mr-2 h-4 w-4", hospitalId === h._id ? "opacity-100" : "opacity-0")} />
                        {h.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <p className="text-sm text-amber-600 py-2">
            لا توجد مستشفيات مخصصة لك. سيتم بدء الدوام بدون تحديد مستشفى — تواصل مع الإدارة لتخصيص المستشفيات.
          </p>
        )}

        <DialogFooter className="sm:justify-start">
          <Button type="button" className="bg-[#5570F1] hover:bg-[#3250e9]" onClick={start} disabled={busy}>
            {busy
              ? isResume
                ? "جاري الاستئناف..."
                : "جاري بدء الدوام..."
              : isResume
              ? "استئناف الدوام"
              : "بدء الدوام"}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="border-2 bg-white text-[#5570F1] border-solid border-[#5570F1]">
              اغلاق
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
