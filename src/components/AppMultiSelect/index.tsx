"use client";

/**
 * Inline multi-select of installed apps for the mom-intake form. A mom may
 * install several apps, so this is a searchable, scrollable checklist (same
 * interaction as {@link ../HospitalMultiSelect} but over plain string values).
 * Options come from the admin-managed list (/api/apps); admins add new ones on
 * the settings page. Fully controlled: `value` is an array of app names.
 */
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { foldArabic } from "@/utils/geo/foldArabic";

export default function AppMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (apps: string[]) => void;
}) {
  const [apps, setApps] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apps")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setApps(Array.isArray(j.apps) ? j.apps : []);
      })
      .catch(() => {
        /* silently ignore — selector just shows no options */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = foldArabic(search);
    return q ? apps.filter((a) => foldArabic(a).includes(q)) : apps;
  }, [apps, search]);

  const toggle = (name: string) => {
    if (selectedSet.has(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  };

  return (
    <div className="rounded-md border bg-white">
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن تطبيق..."
          className="h-8 border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{value.length} محدد</span>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-[#5570F1] hover:underline"
            >
              مسح
            </button>
          )}
        </div>
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {apps.length === 0 ? "لا توجد تطبيقات — أضِفها من صفحة الإعدادات" : "لا توجد نتائج"}
          </p>
        ) : (
          filtered.map((name) => {
            const isSelected = selectedSet.has(name);
            return (
              <div
                key={name}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(name)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {isSelected && <Check className="size-3.5" />}
                </span>
                <span className="text-sm">{name}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
