"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { leavePayMode } from "@/models/enum.constants";

const NOTE_CLASSNAMES =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * Approve / reject controls for a pending leave request.
 *
 * Approving forces a paid-or-unpaid choice, because that decision is the admin's
 * alone and it is what costs the employee money: an unpaid full-day leave is
 * deducted like a no-show, an unpaid permit costs a flat quarter day.
 *
 * Only rendered for an admin looking at somebody else's request — the server
 * rejects self-decisions regardless (the `role` cookie is client-writable, so this
 * is presentation, not enforcement).
 */
export default function LeaveDecisionButtons({ id, userToken }: { id: string; userToken: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [payMode, setPayMode] = useState<leavePayMode | "">("");
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const send = async (path: string, body: Record<string, unknown>, successFallback: string) => {
    setLoading(true);
    try {
      const res = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${userToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || data.error || "تعذّر تنفيذ الإجراء");
        return;
      }
      toast.success(data.message || successFallback);
      router.refresh();
    } catch {
      toast.error("تعذّر تنفيذ الإجراء");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={loading} className="bg-[#5570F1] hover:bg-[#3250e9]">
            اعتماد الطلب
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>اعتماد الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              حدّد ما إذا كان هذا الطلب مدفوعًا. الإجازة غير المدفوعة تُخصم كيوم كامل من الراتب (مثل الغياب)، والاستئذان
              غير المدفوع يُخصم بربع يوم.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>حالة الدفع</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={payMode === leavePayMode.PAID ? "default" : "outline"}
                  className={payMode === leavePayMode.PAID ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setPayMode(leavePayMode.PAID)}
                >
                  مدفوع — بدون خصم
                </Button>
                <Button
                  type="button"
                  variant={payMode === leavePayMode.UNPAID ? "default" : "outline"}
                  className={payMode === leavePayMode.UNPAID ? "bg-orange-600 hover:bg-orange-700" : ""}
                  onClick={() => setPayMode(leavePayMode.UNPAID)}
                >
                  غير مدفوع — يُخصم
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="approveNote">ملاحظة (اختياري)</Label>
              <textarea
                id="approveNote"
                rows={2}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className={NOTE_CLASSNAMES}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <Button
              disabled={loading || !payMode}
              className="bg-[#5570F1] hover:bg-[#3250e9]"
              onClick={() => send(`/api/leave/approve/${id}`, { payMode, decisionNote: approveNote }, "تم اعتماد الطلب")}
            >
              {loading ? "جارٍ الاعتماد..." : "تأكيد الاعتماد"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={loading}>
            رفض الطلب
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>رفض الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              اكتب سبب الرفض ليظهر للموظف. اليوم سيُحسب حسب بيانات الحضور الفعلية (غيابًا إذا لم يحضر).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="rejectNote">سبب الرفض</Label>
            <textarea
              id="rejectNote"
              rows={2}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className={NOTE_CLASSNAMES}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={loading || !rejectNote.trim()}
              onClick={() => send(`/api/leave/reject/${id}`, { decisionNote: rejectNote }, "تم رفض الطلب")}
            >
              {loading ? "جارٍ الرفض..." : "تأكيد الرفض"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Withdraw one's own request while it is still pending. */
export function CancelLeaveButton({ id, userToken }: { id: string; userToken: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const cancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/cancel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${userToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "تعذّر إلغاء الطلب");
        return;
      }
      toast.success(data.message || "تم إلغاء الطلب");
      router.refresh();
    } catch {
      toast.error("تعذّر إلغاء الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={loading}>
          إلغاء الطلب
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد الإلغاء</AlertDialogTitle>
          <AlertDialogDescription>
            هل تريد سحب هذا الطلب؟ يمكنك تقديم طلب جديد لنفس اليوم بعد الإلغاء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>رجوع</AlertDialogCancel>
          <Button variant="destructive" disabled={loading} onClick={cancel}>
            {loading ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
