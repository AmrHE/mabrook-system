/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { userRoles } from "@/models/enum.constants";

interface Employee {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

/**
 * Inline multi-select of employees for assigning them to a hospital. Mirrors
 * HospitalMultiSelect (searchable, scrollable checklist; the row is the click
 * target, the check is presentational). Fully controlled: `value` is an array of
 * employee ids, `onChange` receives the next. Only EMPLOYEE-role users are shown.
 */
export default function EmployeeMultiSelect({
  userToken,
  value,
  onChange,
}: {
  userToken?: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/get-all", { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setEmployees((j.users || []).filter((u: any) => u.role === userRoles.EMPLOYEE));
      })
      .catch(() => {
        /* silently ignore — selector just shows no options */
      });
    return () => {
      cancelled = true;
    };
  }, [userToken]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const nameOf = (e: Employee) => `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.email || "بدون اسم";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => nameOf(e).toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q));
  }, [employees, search]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="rounded-md border bg-white">
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن موظف..."
          className="h-8 border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{value.length} محدد</span>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-xs text-[#5570F1] hover:underline">
              مسح
            </button>
          )}
        </div>
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">لا يوجد موظفون</p>
        ) : (
          filtered.map((e) => {
            const isSelected = selectedSet.has(e._id);
            return (
              <div
                key={e._id}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(e._id)}
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
                <span className="text-sm">
                  {nameOf(e)}
                  {e.email ? <span className="text-muted-foreground"> — {e.email}</span> : ""}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
