export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import Link from 'next/link';
import { columns, type LeaveRow } from './columns';
import { Button } from '@/components/ui/button';
import FilterableTable from '@/components/FilterableTable';
import { leaveStatus, leaveType, leavePayMode, userRoles } from '@/models/enum.constants';
import {
  LEAVE_PAY_MODE_AR,
  LEAVE_STATUS_AR,
  LEAVE_TYPE_AR,
  formatLeaveSpan,
  formatPermitMinutes,
} from '@/utils/leave/labels';
import { userRoleLabel } from '@/utils/user/roleLabels';
import { TIMEZONE } from '@/utils/date/range';

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleString('en-SA', { timeZone: TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }) : '';

/**
 * Leave & permit requests.
 *
 * Visible to every role: admins see all requests (and decide them), everyone else
 * sees only their own — the API does that scoping, this page just renders it.
 */
const LeavesPage = async () => {
  // aliased: `payload` below is the API response body, not the session
  const { userToken, payload: session } = await requireServerSession();
  const role = session.role;
  const isAdmin = role === userRoles.ADMIN;
  const headersList = await headers();
  const host = headersList.get('host');

  async function getLeavesData(userToken: any) {
    const res = await fetch(
      `${process.env.NODE_ENV === 'development' ? process.env.URL : `https://${host}`}/api/leave/get-requests`,
      {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
      },
    );
    return res.json();
  }
  const payload = await getLeavesData(userToken);

  const processed: LeaveRow[] = (payload.leaves || []).map((leave: any) => {
    const requester = leave.userId;
    const decider = leave.decidedBy;
    return {
      id: leave._id,
      employee: requester
        ? `${requester.firstName ?? ''} ${requester.lastName ?? ''}`.trim() || 'غير محدد'
        : 'غير محدد',
      role: userRoleLabel(requester?.role),
      typeLabel: LEAVE_TYPE_AR[leave.type] ?? leave.type,
      span: formatLeaveSpan(leave.startDay, leave.endDay),
      daysCount: leave.daysCount ?? 1,
      duration: formatPermitMinutes(leave.minutes),
      status: leave.status,
      statusLabel: LEAVE_STATUS_AR[leave.status] ?? leave.status,
      // Only an approval carries a pay mode; blank elsewhere so the column never
      // implies a decision that wasn't made.
      payMode: leave.status === leaveStatus.APPROVED ? leave.payMode ?? '' : '',
      payModeLabel:
        leave.status === leaveStatus.APPROVED && leave.payMode ? LEAVE_PAY_MODE_AR[leave.payMode] ?? '' : '',
      reason: leave.reason ?? '',
      decidedByName: decider ? `${decider.firstName ?? ''} ${decider.lastName ?? ''}`.trim() : '',
      createdAtLabel: fmtDate(leave.createdAt),
    };
  });

  const pendingCount = processed.filter((r) => r.status === leaveStatus.PENDING).length;
  // Self-approval is forbidden outright, so a lone admin's own requests would sit
  // pending forever. Say so rather than letting them wonder.
  const soloAdmin = isAdmin && (payload.adminCount ?? 0) < 2;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold p-4">الاستئذانات والإجازات</h1>
        <Button className="bg-[#5570F1] hover:bg-[#3250e9]">
          <Link href="/leaves/create">طلب استئذان جديد</Link>
        </Button>
      </div>

      {soloAdmin && (
        <div className="mb-4 rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          لا يمكن لأي مدير اعتماد طلبه الخاص. يوجد مدير واحد فقط في النظام حاليًا، لذا لن يتمكن أحد من مراجعة طلباتك —
          أضف مديرًا آخر لتفعيل الاعتماد.
        </div>
      )}

      {isAdmin && pendingCount > 0 && (
        <div className="mb-4 rounded-lg bg-blue-50 text-blue-800 px-4 py-3 text-sm">
          {pendingCount} طلب بانتظار المراجعة.
        </div>
      )}

      <FilterableTable
        data={processed}
        columns={columns}
        basePath="/leaves"
        filename="leaves.csv"
        searchKeys={['employee', 'typeLabel', 'reason']}
        searchPlaceholder="ابحث بالاسم أو النوع أو السبب"
        filters={[
          {
            key: 'statusLabel',
            label: 'الحالة',
            options: Object.values(leaveStatus).map((s) => ({ label: LEAVE_STATUS_AR[s], value: LEAVE_STATUS_AR[s] })),
          },
          {
            key: 'typeLabel',
            label: 'النوع',
            options: Object.values(leaveType).map((t) => ({ label: LEAVE_TYPE_AR[t], value: LEAVE_TYPE_AR[t] })),
          },
          {
            key: 'payMode',
            label: 'مدفوع؟',
            options: Object.values(leavePayMode).map((p) => ({ label: LEAVE_PAY_MODE_AR[p], value: p })),
          },
        ]}
        exportColumns={[
          { key: 'employee', header: 'مقدّم الطلب' },
          { key: 'role', header: 'الدور' },
          { key: 'typeLabel', header: 'النوع' },
          { key: 'span', header: 'التاريخ' },
          { key: 'daysCount', header: 'عدد الأيام' },
          { key: 'duration', header: 'المدة' },
          { key: 'statusLabel', header: 'الحالة' },
          { key: 'payModeLabel', header: 'مدفوع؟' },
          { key: 'reason', header: 'السبب' },
          { key: 'decidedByName', header: 'تم القرار بواسطة' },
          { key: 'createdAtLabel', header: 'تاريخ الطلب' },
        ]}
      />
    </div>
  );
};

export default LeavesPage;
