"use client";

import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const fmtAmount = (n?: number) =>
  typeof n === "number" ? `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س` : "—";

/** One label/value line; long values (an IBAN) wrap rather than overflow the dialog. */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="shrink-0 text-xs text-gray-500">{label}</span>
      <span className={`text-end text-sm text-gray-800 break-all ${mono ? "font-mono tracking-wide" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

/**
 * Collapses the payroll table's banking columns into one "عرض البيانات" trigger
 * that opens the employee's transfer details.
 *
 * The IBAN gets a copy button because it's long enough that retyping it into a
 * bank portal is a real error risk. Renders "—" when nothing is on file, so a
 * missing IBAN stays visible in the table instead of hiding behind a link.
 */
export default function BankDetailsModal({
  employeeName,
  bankName,
  iban,
  netSalary,
  triggerText = "عرض البيانات",
}: {
  employeeName?: string;
  bankName?: string;
  iban?: string;
  netSalary?: number;
  triggerText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!bankName && !iban) return <span className="text-gray-400">—</span>;

  const copyIban = async () => {
    if (!iban) return;
    try {
      await navigator.clipboard.writeText(iban);
      setCopied(true);
      toast.success("تم نسخ الآيبان");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر نسخ الآيبان");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[#5570F1] hover:underline cursor-pointer"
        >
          <Landmark className="size-3.5 shrink-0" />
          <span>{triggerText}</span>
        </button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>البيانات البنكية</DialogTitle>
        </DialogHeader>

        <div>
          <Field label="الموظف" value={employeeName ?? ""} />
          <Field label="البنك" value={bankName ?? ""} />
          <div className="flex items-start justify-between gap-4 border-b py-2.5">
            <span className="shrink-0 text-xs text-gray-500">الآيبان</span>
            <div className="flex items-start gap-2">
              <span className="text-end text-sm text-gray-800 font-mono tracking-wide break-all">{iban || "—"}</span>
              {iban && (
                <button
                  type="button"
                  onClick={copyIban}
                  aria-label="نسخ الآيبان"
                  title="نسخ الآيبان"
                  className="shrink-0 text-gray-400 hover:text-[#5570F1] cursor-pointer"
                >
                  {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                </button>
              )}
            </div>
          </div>
          <Field label="المبلغ المستحق" value={fmtAmount(netSalary)} />
        </div>

        {!iban && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            لا يوجد آيبان مسجّل لهذا الموظف — أضفه من صفحة تعديل بيانات الموظف قبل تنفيذ التحويل.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
