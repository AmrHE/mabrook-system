"use client";

/**
 * Searchable nationality picker for the mom-intake form. Replaces the old
 * free-text input so values stay canonical (no يمني/اليمن/yemeni drift).
 * Fetches the canonical list from /api/nationalities; admins can add a missing
 * one inline (persisted via /api/nationalities/add).
 *
 * Controlled: parent owns the value and passes onChange.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { foldArabic } from "@/utils/geo/foldArabic";
import SearchSelect from "@/components/SearchSelect";

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

export default function NationalitySelect({
  value,
  onChange,
  userToken,
  isAdmin = false,
}: {
  value: string;
  onChange: (value: string) => void;
  userToken?: string;
  isAdmin?: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/nationalities")
      .then((r) => r.json())
      .then((d) => {
        if (active) setOptions(Array.isArray(d.nationalities) ? d.nationalities : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAddNew = useCallback(
    async (name: string) => {
      const res = await fetch("/api/nationalities/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${userToken ?? ""}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "فشل إضافة الجنسية");
        throw new Error("add failed");
      }
      const canonical = data.name as string;
      setOptions((prev) => [...new Set([...prev, canonical])].sort((a, b) => collator.compare(a, b)));
      onChange(canonical);
      toast.success("تمت إضافة الجنسية");
    },
    [userToken, onChange],
  );

  return (
    <SearchSelect
      value={value}
      options={options}
      loading={loading}
      placeholder="اختر الجنسية..."
      searchPlaceholder="ابحث عن الجنسية..."
      emptyText="لا توجد نتائج"
      fold={foldArabic}
      onSelect={onChange}
      onAddNew={isAdmin ? handleAddNew : undefined}
    />
  );
}
