"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { reclassifiedSuffix } from "@/utils/geo/fenceToast";
import type { LatLng } from "@/components/HospitalLocationPicker";

// Leaflet must never run on the server.
const HospitalLocationPicker = dynamic(() => import("@/components/HospitalLocationPicker"), { ssr: false });

/**
 * Admin dialog to set/change a hospital's geofence location. Backs the
 * previously-missing hospital edit flow (used to backfill existing hospitals).
 */
export default function EditHospitalLocationDialog({
  id,
  userToken,
  initialLocation,
}: {
  id: string;
  userToken: string;
  initialLocation?: LatLng | null;
}) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<LatLng | null>(initialLocation ?? null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = async () => {
    if (!location) {
      toast.error("الرجاء تحديد موقع على الخريطة");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/hospitals/update/${id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ location }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("تم حفظ موقع المستشفى" + reclassifiedSuffix(data.reclassified));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(data.message || "فشل حفظ الموقع");
      }
    } catch {
      toast.error("فشل حفظ الموقع");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2 border-[#5570F1] text-[#5570F1]">
          <MapPin className="size-4" />
          {initialLocation ? "تعديل موقع المستشفى" : "تحديد موقع المستشفى"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>موقع المستشفى</DialogTitle>
          <DialogDescription>
            ابحث عن المستشفى أو انقر على الخريطة لتحديد موقعه. يُستخدم هذا الموقع لتقييد تسجيل بدء الدوام والزيارات.
          </DialogDescription>
        </DialogHeader>

        <HospitalLocationPicker value={location} onChange={setLocation} />

        <DialogFooter className="sm:justify-start">
          <Button type="button" className="bg-[#5570F1] hover:bg-[#3250e9]" onClick={save} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ"}
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
