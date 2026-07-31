"use client";

/**
 * Cascading, searchable city → district picker for hospitals. Replaces the old
 * free-text city/district inputs so values stay canonical (no جدة/جده drift).
 *
 * - Cities/districts are fetched from /api/locations/* (the large national
 *   dataset lives server-side; only names cross the wire).
 * - Searchable via a Popover + cmdk Command combobox (the pattern proven inside a
 *   Dialog by AddNewVisitDialog). We filter client-side with Arabic folding and
 *   cap the rendered rows so the 3.9k-city list stays snappy.
 * - District is disabled until a city is chosen and refetches on city change.
 * - Admins (only) get an "add new" affordance when the typed value has no match;
 *   it persists via /api/locations/add (LocationAddition) and becomes selectable.
 *
 * Controlled: parent owns { city, district } and passes onChange.
 */
import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { foldArabic, foldDistrict } from "@/utils/geo/foldArabic";
import SearchSelect from "@/components/SearchSelect";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

export default function LocationPicker({
  city,
  district,
  onChange,
  userToken,
  isAdmin = false,
}: {
  city: string;
  district: string;
  onChange: (next: { city: string; district: string }) => void;
  userToken?: string;
  isAdmin?: boolean;
}) {
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  // Load the city list once.
  useEffect(() => {
    let active = true;
    fetch("/api/locations/cities")
      .then((r) => r.json())
      .then((d) => {
        if (active) setCities(Array.isArray(d.cities) ? d.cities : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load districts whenever the selected city changes.
  useEffect(() => {
    if (!city) {
      setDistricts([]);
      return;
    }
    let active = true;
    setDistrictsLoading(true);
    fetch(`/api/locations/districts?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setDistricts(Array.isArray(d.districts) ? d.districts : []);
      })
      .catch(() => {
        if (active) setDistricts([]);
      })
      .finally(() => {
        if (active) setDistrictsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [city]);

  const addLocation = useCallback(
    async (kind: "city" | "district", name: string, parentCity?: string): Promise<string> => {
      const res = await fetch("/api/locations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${userToken ?? ""}` },
        body: JSON.stringify({ kind, name, city: parentCity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "فشل إضافة الموقع");
        throw new Error("add failed");
      }
      return data.name as string;
    },
    [userToken],
  );

  const handleAddCity = useCallback(
    async (name: string) => {
      const canonical = await addLocation("city", name);
      setCities((prev) => [...new Set([...prev, canonical])].sort((a, b) => collator.compare(a, b)));
      onChange({ city: canonical, district: "" });
      toast.success("تمت إضافة المدينة");
    },
    [addLocation, onChange],
  );

  const handleAddDistrict = useCallback(
    async (name: string) => {
      const canonical = await addLocation("district", name, city);
      setDistricts((prev) => [...new Set([...prev, canonical])].sort((a, b) => collator.compare(a, b)));
      onChange({ city, district: canonical });
      toast.success("تمت إضافة الحي");
    },
    [addLocation, city, onChange],
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>المدينة</Label>
        <SearchSelect
          value={city}
          options={cities}
          loading={citiesLoading}
          placeholder="اختر المدينة..."
          searchPlaceholder="ابحث عن المدينة..."
          emptyText="لا توجد نتائج"
          fold={foldArabic}
          onSelect={(v) => onChange({ city: v, district: "" })}
          onAddNew={isAdmin ? handleAddCity : undefined}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>الحي/المنطقة</Label>
        <SearchSelect
          value={district}
          options={districts}
          loading={districtsLoading}
          disabled={!city}
          placeholder={city ? "اختر الحي..." : "اختر المدينة أولاً"}
          searchPlaceholder="ابحث عن الحي..."
          emptyText={city ? "لا توجد أحياء مسجلة لهذه المدينة" : "اختر المدينة أولاً"}
          fold={foldDistrict}
          onSelect={(v) => onChange({ city, district: v })}
          onAddNew={isAdmin && city ? handleAddDistrict : undefined}
        />
      </div>
    </div>
  );
}
