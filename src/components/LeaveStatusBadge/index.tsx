import { leaveStatus, leavePayMode } from "@/models/enum.constants";
import { LEAVE_PAY_MODE_AR, LEAVE_STATUS_AR } from "@/utils/leave/labels";

const STATUS_CLASSNAMES: Record<leaveStatus, string> = {
  [leaveStatus.PENDING]: "bg-amber-100 text-amber-700",
  [leaveStatus.APPROVED]: "bg-green-100 text-green-700",
  [leaveStatus.REJECTED]: "bg-red-100 text-red-700",
  [leaveStatus.CANCELLED]: "bg-gray-100 text-gray-600",
};

const PAY_MODE_CLASSNAMES: Record<leavePayMode, string> = {
  [leavePayMode.PAID]: "bg-green-100 text-green-700",
  [leavePayMode.UNPAID]: "bg-orange-100 text-orange-700",
};

/**
 * Colored pill for a leave request's status. Pure presentational (safe in server
 * and client components), same shape as `FenceBadge`.
 */
export default function LeaveStatusBadge({ status }: { status?: string }) {
  if (!status || !(status in STATUS_CLASSNAMES)) return <span className="text-gray-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_CLASSNAMES[status as leaveStatus]
      }`}
    >
      {LEAVE_STATUS_AR[status as leaveStatus]}
    </span>
  );
}

/** Paid / unpaid pill. Only meaningful on an approved request. */
export function LeavePayModeBadge({ payMode }: { payMode?: string }) {
  if (!payMode || !(payMode in PAY_MODE_CLASSNAMES)) return <span className="text-gray-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        PAY_MODE_CLASSNAMES[payMode as leavePayMode]
      }`}
    >
      {LEAVE_PAY_MODE_AR[payMode as leavePayMode]}
    </span>
  );
}
