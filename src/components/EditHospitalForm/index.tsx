"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import EmployeeMultiSelect from "@/components/EmployeeMultiSelect";
import LocationPicker from "@/components/LocationPicker";
import type { LatLng } from "@/components/HospitalLocationPicker";

// Leaflet must never run on the server.
const HospitalLocationPicker = dynamic(() => import("@/components/HospitalLocationPicker"), { ssr: false });

/**
 * Admin form to edit a hospital's core details (name / city / district) and its
 * geofence location, all in one place. Backs the "edit" tab on the hospital page.
 * PUTs to /api/hospitals/update/{id} (which validates + is admin-guarded).
 */
export default function EditHospitalForm({
  id,
  userToken,
  initialName,
  initialCity,
  initialDistrict,
  initialLocation,
  initialAssignedEmployeeIds,
  isAdmin = false,
}: {
  id: string;
  userToken: string;
  initialName?: string;
  initialCity?: string;
  initialDistrict?: string;
  initialLocation?: LatLng | null;
  initialAssignedEmployeeIds?: string[];
  isAdmin?: boolean;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [district, setDistrict] = useState(initialDistrict ?? "");
  const [location, setLocation] = useState<LatLng | null>(initialLocation ?? null);
  const [employeeIds, setEmployeeIds] = useState<string[]>(initialAssignedEmployeeIds ?? []);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = async () => {
    if (!name.trim() || !city.trim() || !district.trim()) {
      toast.error("الرجاء تعبئة اسم المستشفى والمدينة والحي");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/hospitals/update/${id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name, city, district, location: location ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "فشل حفظ البيانات");
        return;
      }

      // Sync the assigned employees (two-way relation lives on User.assignedHospitals).
      const res2 = await fetch(`/api/hospitals/assign-employees/${id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: JSON.stringify({ employeeIds }),
      });
      const data2 = await res2.json();
      if (!res2.ok) {
        toast.error(data2.message || "تم حفظ البيانات لكن تعذّر تحديث الموظفين المعينين");
        return;
      }

      toast.success("تم حفظ بيانات المستشفى والموظفين المعينين");
      router.refresh();
    } catch {
      toast.error("فشل حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4 mt-4">
      <div className="grid gap-1.5">
        <Label htmlFor="edit-name">اسم المستشفى</Label>
        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
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
      <div className="grid gap-1.5 z-50">
        <Label>موقع المستشفى (لتقييد تسجيل الحضور)</Label>
        <HospitalLocationPicker value={location} onChange={setLocation} />
      </div>
      <div className="grid gap-1.5">
        <Label>الموظفون المعينون</Label>
        <EmployeeMultiSelect userToken={userToken} value={employeeIds} onChange={setEmployeeIds} />
      </div>
      <Button onClick={save} disabled={saving} className="bg-[#5570F1] hover:bg-[#3250e9]">
        {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
      </Button>
    </div>
  );
}
