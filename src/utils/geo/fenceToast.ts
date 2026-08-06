import { toast } from "sonner";
import { fenceStatus } from "@/models/enum.constants";

/**
 * Surface a non-blocking warning based on how the server classified a check-in.
 * Shared by the shift-start and visit-start flows. Soft mode: the action already
 * succeeded — this only informs the employee/admin.
 */
/**
 * Toast suffix reporting how many stored verdicts an edit rewrote. Shared by the
 * settings save and the hospital-location save: both silently rewrite historical
 * badges, which reads as a bug unless the admin is told it happened.
 */
export function reclassifiedSuffix(result?: { shifts: number; visits: number } | null): string {
  const count = result ? result.shifts + result.visits : 0;
  return count > 0 ? ` — أُعيد تصنيف ${count} تسجيل حضور` : "";
}

export function warnOnFence(status?: fenceStatus | string, distance?: number, context: "shift" | "visit" = "shift") {
  const noun = context === "visit" ? "الزيارة" : "الدوام";
  if (status === fenceStatus.OUT_OF_RANGE) {
    toast.warning(`أنت خارج نطاق المستشفى${distance ? ` (${distance} م تقريبًا)` : ""}. تم تسجيل ${noun} مع الإشارة لذلك.`);
  } else if (status === fenceStatus.NO_LOCATION_FIX) {
    toast.warning(`تعذّر تحديد موقعك. تم تسجيل ${noun} بدون التحقق من الموقع.`);
  } else if (status === fenceStatus.HOSPITAL_NOT_CONFIGURED) {
    toast.warning(`لم يتم تحديد موقع لهذه المستشفى بعد. تم تسجيل ${noun} بدون التحقق من الموقع.`);
  }
}
