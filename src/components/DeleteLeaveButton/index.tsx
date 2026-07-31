"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

/**
 * Admin-only soft delete — the escape hatch for a mistaken decision, since an
 * approval itself can't be reversed. Deleting an approved request also undoes its
 * payroll effect, so the dialog says so.
 */
export default function DeleteLeaveButton({ id, userToken }: { id: string; userToken: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/delete/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${userToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "حدث خطأ أثناء حذف الطلب");
        return;
      }
      toast.success(data.message || "تم حذف الطلب");
      router.push("/leaves");
      router.refresh();
    } catch {
      toast.error("حدث خطأ أثناء حذف الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={loading}>
          حذف الطلب
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
          <AlertDialogDescription>
            سيتم حذف هذا الطلب من السجلات والتقارير. إذا كان معتمدًا، سيعود اليوم إلى ما تُظهره بيانات الحضور الفعلية
            (غيابًا إذا لم يحضر الموظف). لا يمكن التراجع.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "جارٍ الحذف..." : "تأكيد الحذف"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
