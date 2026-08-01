"use client";

/**
 * Move boxes from the hospital being viewed to another one.
 *
 * Exists because stock drifts: one hospital ends up sitting on a pile while
 * another runs dry. Editing both hospitals' absolute quantities by hand is two
 * separate saves that invent or destroy stock if one fails, so the actual move
 * happens atomically server-side (/api/hospitals/transfer-stock) and this is
 * just the picker for it.
 *
 * The destination list comes from /api/hospitals/get-hospitals, which is already
 * role-scoped (admins see every hospital, employees only their assignments), so
 * the dropdown can never offer a destination the API would reject.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ProductStock {
  _id: string;
  product: { _id: string; name: string; size?: string } | null;
  quantity: number;
}

type HospitalOption = { _id: string; name: string };

const TransferStockDialog = ({
  userToken,
  hospitalId,
  hospitalName,
  productStocks,
}: {
  userToken: string | undefined;
  hospitalId: string;
  hospitalName?: string;
  productStocks: ProductStock[];
}) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [destinationId, setDestinationId] = useState("");
  // productId -> amount typed by the user (kept as a string so the field can be blank).
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Only boxes actually on hand here can be moved; a deleted product populates
  // to null, which would otherwise blow up on `.name`.
  const transferable = useMemo(
    () => (productStocks || []).filter((s) => s.product && (s.quantity || 0) > 0),
    [productStocks],
  );

  useEffect(() => {
    if (!open || hospitals.length > 0) return;

    setLoadingHospitals(true);
    fetch("/api/hospitals/get-hospitals", { headers: { authorization: `Bearer ${userToken}` } })
      .then((res) => res.json())
      .then((data) => {
        const list: HospitalOption[] = (data?.hospitals || [])
          .filter((h: HospitalOption) => String(h._id) !== String(hospitalId))
          .map((h: HospitalOption) => ({ _id: String(h._id), name: h.name }));
        setHospitals(list);
      })
      .catch(() => toast.error("تعذّر تحميل قائمة المستشفيات."))
      .finally(() => setLoadingHospitals(false));
  }, [open, hospitals.length, userToken, hospitalId]);

  const reset = () => {
    setDestinationId("");
    setAmounts({});
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleAmountChange = (productId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [productId]: value }));
  };

  const handleTransfer = async () => {
    if (!destinationId) {
      toast.error("الرجاء اختيار المستشفى الوجهة");
      return;
    }

    const items: { productId: string; quantity: number }[] = [];
    for (const stock of transferable) {
      const productId = stock.product!._id;
      const raw = (amounts[productId] || "").trim();
      if (!raw) continue;

      const quantity = Number(raw);
      if (!Number.isInteger(quantity) || quantity < 0) {
        toast.error(`الكمية المدخلة لـ "${stock.product!.name}" غير صالحة`);
        return;
      }
      if (quantity === 0) continue;
      if (quantity > stock.quantity) {
        toast.error(`لا يمكن نقل أكثر من ${stock.quantity} من "${stock.product!.name}"`);
        return;
      }
      items.push({ productId, quantity });
    }

    if (items.length === 0) {
      toast.error("الرجاء إدخال كمية واحدة على الأقل للنقل");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/hospitals/transfer-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ fromHospitalId: hospitalId, toHospitalId: destinationId, items }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.message || "حدث خطأ ما أثناء نقل المخزون. الرجاء المحاولة مرة أخرى.");
        return;
      }

      toast.success(data?.message || "تم نقل المخزون بنجاح");
      handleOpenChange(false);
      router.refresh();
    } catch {
      toast.error("حدث خطأ ما أثناء نقل المخزون. الرجاء المحاولة مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const destinationName = hospitals.find((h) => h._id === destinationId)?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="border-2 border-[#5570F1] text-[#5570F1] hover:text-[#3250e9]">
          <ArrowLeftRight className="size-4" />
          نقل مخزون إلى مستشفى أخرى
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>نقل مخزون</DialogTitle>
          <DialogDescription>
            {`النقل من ${hospitalName ? `مستشفى ${hospitalName}` : "هذه المستشفى"} إلى مستشفى أخرى. أدخل الكمية المراد نقلها لكل منتج.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label>المستشفى الوجهة</Label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                disabled={loadingHospitals}
                className="w-full justify-between font-normal"
              >
                <span className={cn("truncate", !destinationName && "text-muted-foreground")}>
                  {loadingHospitals ? "جاري التحميل..." : destinationName || "اختر المستشفى..."}
                </span>
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
              <Command dir="rtl">
                <CommandInput placeholder="ابحث عن المستشفى..." className="h-9" />
                <CommandList className="z-50 max-h-64">
                  <CommandEmpty>لا توجد مستشفيات متاحة.</CommandEmpty>
                  <CommandGroup>
                    {hospitals.map((h) => (
                      <CommandItem
                        key={h._id}
                        value={h.name}
                        onSelect={() => {
                          setDestinationId(h._id);
                          setPickerOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Check className={cn("ml-2 h-4 w-4", destinationId === h._id ? "opacity-100" : "opacity-0")} />
                        {h.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-2 max-h-[45vh] overflow-y-auto pe-1">
          {transferable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">لا يوجد مخزون قابل للنقل في هذه المستشفى.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {transferable.map((stock) => (
                <div key={stock._id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{stock.product!.name}</p>
                    <p className="text-xs text-muted-foreground">المتاح: {stock.quantity}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={stock.quantity}
                    step={1}
                    placeholder="0"
                    className="w-28 shrink-0"
                    value={amounts[stock.product!._id] ?? ""}
                    onChange={(e) => handleAmountChange(stock.product!._id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            className="bg-[#5570F1] hover:bg-[#3250e9]"
            onClick={handleTransfer}
            disabled={isLoading || transferable.length === 0}
          >
            {isLoading ? "جاري النقل..." : "نقل المخزون"}
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
};

export default TransferStockDialog;
