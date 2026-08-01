"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
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

const MAX_LENGTH = 2000;

// Same textarea styling used by the leave forms — this project has no
// components/ui/textarea primitive.
const NOTE_CLASSNAMES =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-SA", {
        timeZone: "Asia/Riyadh",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

/**
 * Free-text note on a visit, editable by anyone who can reach the visit.
 *
 * `variant="cell"` is the visits-table trigger: it must stopPropagation, since
 * FilterableTable navigates on row click. `variant="inline"` is the button form
 * used on the visit detail page, where the note itself is rendered above it.
 */
export default function VisitNotesModal({
  visitId,
  initialNotes = "",
  updatedByName,
  updatedAt,
  userToken,
  variant = "cell",
}: {
  visitId: string;
  initialNotes?: string;
  updatedByName?: string;
  updatedAt?: string | null;
  userToken?: string;
  variant?: "cell" | "inline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  // router.refresh() re-renders the server component without remounting this
  // one, so without this the textarea would keep showing the pre-save text.
  useEffect(() => {
    setValue(initialNotes ?? "");
  }, [initialNotes]);

  const handleOpenChange = (next: boolean) => {
    // Discard an abandoned edit rather than carrying it into the next open.
    if (!next) setValue(initialNotes ?? "");
    setOpen(next);
  };

  const unchanged = value.trim() === (initialNotes ?? "").trim();

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/visit/notes/${visitId}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ notes: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || "حدث خطأ أثناء حفظ الملاحظة. الرجاء المحاولة مرة أخرى.");
        return;
      }
      toast.success("تم حفظ الملاحظة بنجاح!");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("حدث خطأ أثناء حفظ الملاحظة. الرجاء المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  const hasNote = Boolean((initialNotes ?? "").trim());

  const trigger =
    variant === "inline" ? (
      <Button
        type="button"
        variant="outline"
        className="border-2 bg-white text-[#5570F1] border-solid border-[#5570F1]"
      >
        {hasNote ? "تعديل الملاحظة" : "إضافة ملاحظة"}
      </Button>
    ) : (
      <button
        type="button"
        // Essential: the surrounding table row navigates on click.
        onClick={(e) => e.stopPropagation()}
        title={hasNote ? initialNotes : "إضافة ملاحظة"}
        className={
          hasNote
            ? "inline-flex max-w-[200px] items-center gap-1 text-[#5570F1] hover:underline cursor-pointer"
            : "inline-flex max-w-[200px] items-center gap-1 text-xs text-gray-400 hover:text-[#5570F1] cursor-pointer"
        }
      >
        <StickyNote className="size-3.5 shrink-0" />
        <span className="truncate">{hasNote ? initialNotes : "إضافة ملاحظة"}</span>
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>ملاحظات الزيارة</DialogTitle>
          <DialogDescription>
            يمكن لأي مستخدم لديه صلاحية الوصول إلى الزيارة إضافة الملاحظة أو تعديلها.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <textarea
            id={`visit-notes-${visitId}`}
            rows={6}
            maxLength={MAX_LENGTH}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="اكتب ملاحظتك عن الزيارة..."
            className={NOTE_CLASSNAMES}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {value.length} / {MAX_LENGTH}
            </span>
            {updatedAt && (
              <span className="text-gray-500">
                آخر تعديل: {updatedByName ? `${updatedByName} — ` : ""}
                {fmtDate(updatedAt)}
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="border-2 bg-white text-[#5570F1] border-solid border-[#5570F1]"
            >
              إلغاء
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={save}
            disabled={saving || unchanged}
            className="bg-[#5570F1] hover:bg-[#3250e9]"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
