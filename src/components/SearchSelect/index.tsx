"use client";

/**
 * Searchable single-select combobox (Popover + cmdk Command) with an optional
 * admin-only "add new" affordance. Filters client-side with a caller-supplied
 * fold function (Arabic-aware) and caps rendered rows so long lists stay snappy.
 *
 * Shared by LocationPicker (city/district) and NationalitySelect. Proven to work
 * inside a Dialog (see AddNewVisitDialog); parents that host it in a dialog should
 * set onInteractOutside preventDefault so the portalled popover doesn't close it.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MAX_RENDERED = 100;

export default function SearchSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
  fold,
  onSelect,
  onAddNew,
}: {
  value: string;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
  /** Fold function for client-side matching (e.g. foldArabic / foldDistrict). */
  fold: (value: string) => string;
  onSelect: (value: string) => void;
  /** Present only for admins; adds a new canonical entry. Rejects → toast by caller. */
  onAddNew?: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const trimmed = query.trim();
  const foldedQuery = fold(trimmed);

  const filtered = useMemo(() => {
    const base = foldedQuery ? options.filter((o) => fold(o).includes(foldedQuery)) : options;
    return base.slice(0, MAX_RENDERED);
  }, [options, foldedQuery, fold]);

  const exactExists = useMemo(
    () => foldedQuery.length > 0 && options.some((o) => fold(o) === foldedQuery),
    [options, foldedQuery, fold],
  );

  const canAdd = !!onAddNew && trimmed.length > 0 && !exactExists;

  const handleAdd = async () => {
    if (!onAddNew) return;
    setAdding(true);
    try {
      await onAddNew(trimmed);
      setQuery("");
      setOpen(false);
    } catch {
      // toast already shown by caller
    } finally {
      setAdding(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        align="start"
        side="bottom"
        sideOffset={4}
        className="p-0 z-50"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command shouldFilter={false} dir="rtl">
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="z-50 max-h-64">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">جاري التحميل...</div>
            ) : (
              <>
                {filtered.length === 0 && !canAdd && (
                  <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
                )}
                <CommandGroup>
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => {
                        onSelect(opt);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check className={cn("ml-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {canAdd && (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={adding}
              onClick={handleAdd}
            >
              <Plus className="ml-2 h-4 w-4" />
              {adding ? "جاري الإضافة..." : `إضافة "${trimmed}"`}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
