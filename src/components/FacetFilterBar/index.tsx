/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface FacetColumn {
  key: string;
  label: string;
}

/** facetKey -> selected String(value)s. Empty/missing array = facet inactive. */
export type FacetSelection = Record<string, string[]>;

/** AND across facets, OR within a facet. */
export function applyFacetFilters<T extends Record<string, any>>(
  rows: T[],
  selected: FacetSelection,
): T[] {
  const active = Object.entries(selected).filter(([, vals]) => vals && vals.length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(([key, vals]) => vals.includes(String(row[key] ?? ""))));
}

const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

interface FacetFilterBarProps<T extends Record<string, any>> {
  rows: T[];
  facets: FacetColumn[];
  selected: FacetSelection;
  onChange: (next: FacetSelection) => void;
  className?: string;
}

/**
 * Multi-select facet toolbar over already-loaded rows. Values are derived from
 * the data itself; selection state is controlled so the parent can feed the
 * filtered rows to the table, the CSV export, and the row count alike.
 */
export default function FacetFilterBar<T extends Record<string, any>>({
  rows,
  facets,
  selected,
  onChange,
  className = "",
}: FacetFilterBarProps<T>) {
  const facetValues = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of facets) {
      const set = new Set<string>();
      for (const r of rows) set.add(String(r[f.key] ?? ""));
      out[f.key] = [...set].filter((v) => v !== "").sort((a, b) => collator.compare(a, b));
    }
    return out;
  }, [rows, facets]);

  const toggle = (facetKey: string, value: string) => {
    const cur = selected[facetKey] ?? [];
    onChange({
      ...selected,
      [facetKey]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
    });
  };

  const clearFacet = (facetKey: string) => onChange({ ...selected, [facetKey]: [] });

  const totalActive = Object.values(selected).reduce((n, vals) => n + (vals?.length ?? 0), 0);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {facets.map((f) => {
        const chosen = selected[f.key] ?? [];
        return (
          <Popover key={f.key}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white">
                {f.label}
                {chosen.length > 0 && (
                  <span className="ms-1 rounded-full bg-primary/10 text-primary text-xs px-1.5 tabular-nums">
                    {chosen.length}
                  </span>
                )}
                <ChevronDown className="size-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-0" dir="rtl">
              <Command dir="rtl">
                <CommandInput placeholder="بحث..." />
                <CommandList>
                  <CommandEmpty>لا نتائج</CommandEmpty>
                  <CommandGroup>
                    {(facetValues[f.key] ?? []).map((v) => (
                      <CommandItem key={v} value={v} onSelect={() => toggle(f.key, v)}>
                        <Checkbox checked={chosen.includes(v)} className="pointer-events-none" />
                        <span className="truncate">{v}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {chosen.length > 0 && (
                  <div className="border-t p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-muted-foreground"
                      onClick={() => clearFacet(f.key)}
                    >
                      مسح
                    </Button>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>
        );
      })}
      {totalActive > 0 && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange({})}>
          <X className="size-3.5" />
          مسح الكل
        </Button>
      )}
    </div>
  );
}
