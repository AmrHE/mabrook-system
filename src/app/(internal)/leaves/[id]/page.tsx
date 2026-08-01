/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import LeaveStatusBadge, { LeavePayModeBadge } from '@/components/LeaveStatusBadge';
import LeaveDecisionButtons, { CancelLeaveButton } from '@/components/LeaveDecisionButtons';
import DeleteLeaveButton from '@/components/DeleteLeaveButton';
import { leaveStatus, leaveType, leavePayMode, userRoles } from '@/models/enum.constants';
import { formatLeaveSpan, formatPermitMinutes, leaveTypeLabel } from '@/utils/leave/labels';
import { userRoleLabel } from '@/utils/user/roleLabels';
import { TIMEZONE } from '@/utils/date/range';

export const dynamic = 'force-dynamic';

const PERMIT_TYPES: string[] = [leaveType.DELAY_PERMIT, leaveType.EARLY_LEAVE];

const fmtDateTime = (d: any) =>
  d ? new Date(d).toLocaleString('en-SA', { timeZone: TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }) : '—';

async function getLeaveData(id: string, userToken: any) {
  const headersList = await headers();
  const host = headersList.get('host');

  const res = await fetch(
    `${process.env.NODE_ENV === 'development' ? process.env.URL : `https://${host}`}/api/leave/get-request/${id}`,
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

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 border-b py-3 last:border-b-0">
    <span className="text-sm text-gray-500 shrink-0">{label}</span>
    <span className="text-sm text-gray-800 text-end">{children}</span>
  </div>
);

const SingleLeavePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  // aliased: `payload` below is the API response body, not the session
  const { userToken, payload: session } = await requireServerSession();
  const userRole = session.role;
  const userId = session._id;

  const { id } = await params;
  const payload = await getLeaveData(id, userToken);
  const leave = payload?.leave;

  if (!leave) {
    return (
      <div className="p-5 w-full min-h-[92vh] bg-white rounded-3xl">
        <h1 className="text-2xl font-bold mb-4">الطلب غير موجود</h1>
        <p className="text-gray-500 mb-6">{payload?.message || 'تعذّر تحميل هذا الطلب.'}</p>
        <Button variant="outline">
          <Link href="/leaves">رجوع للقائمة</Link>
        </Button>
      </div>
    );
  }

  const requester = leave.userId;
  const requesterId = String(requester?._id ?? requester ?? '');
  const requesterName = requester
    ? `${requester.firstName ?? ''} ${requester.lastName ?? ''}`.trim() || 'غير محدد'
    : 'غير محدد';
  const decider = leave.decidedBy;

  const isAdmin = userRole === userRoles.ADMIN;
  const isOwnRequest = requesterId === String(userId ?? '');
  const isPending = leave.status === leaveStatus.PENDING;
  // An admin may never decide their own request — no exception for a lone admin.
  const canDecide = isAdmin && isPending && !isOwnRequest;
  const soloAdmin = (payload.adminCount ?? 0) < 2;

  return (
    <div className="p-5 w-full min-h-[92vh] bg-white rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-gray-800 font-bold text-3xl">{leaveTypeLabel(leave.type)}</h1>
          <LeaveStatusBadge status={leave.status} />
        </div>
        <Button variant="outline">
          <Link href="/leaves">رجوع للقائمة</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h4 className="mb-2 font-semibold text-gray-700 text-xl">تفاصيل الطلب</h4>
          <Row label="مقدّم الطلب">{requesterName}</Row>
          <Row label="الدور">{userRoleLabel(requester?.role)}</Row>
          <Row label="البريد">{requester?.email || '—'}</Row>
          <Row label="التاريخ">{formatLeaveSpan(leave.startDay, leave.endDay)}</Row>
          <Row label="عدد الأيام">{leave.daysCount ?? 1}</Row>
          {PERMIT_TYPES.includes(leave.type) && <Row label="المدة">{formatPermitMinutes(leave.minutes)}</Row>}
          <Row label="السبب">{leave.reason || '—'}</Row>
          <Row label="تاريخ التقديم">{fmtDateTime(leave.createdAt)}</Row>
        </section>

        <section>
          <h4 className="mb-2 font-semibold text-gray-700 text-xl">القرار</h4>
          <Row label="الحالة">
            <LeaveStatusBadge status={leave.status} />
          </Row>
          <Row label="مدفوع؟">
            {leave.status === leaveStatus.APPROVED ? <LeavePayModeBadge payMode={leave.payMode} /> : '—'}
          </Row>
          <Row label="تم القرار بواسطة">
            {decider ? `${decider.firstName ?? ''} ${decider.lastName ?? ''}`.trim() || '—' : '—'}
          </Row>
          <Row label="تاريخ القرار">{fmtDateTime(leave.decidedAt)}</Row>
          <Row label="ملاحظة القرار">{leave.decisionNote || '—'}</Row>

          {leave.status === leaveStatus.APPROVED && (
            <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
              {leave.payMode === leavePayMode.UNPAID
                ? PERMIT_TYPES.includes(leave.type)
                  ? 'استئذان غير مدفوع: يُخصم ربع يوم من الراتب.'
                  : 'إجازة غير مدفوعة: تُخصم كيوم كامل من الراتب، مثل الغياب.'
                : 'طلب مدفوع: لا يترتب عليه أي خصم من الراتب.'}
            </p>
          )}
        </section>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {canDecide && <LeaveDecisionButtons id={id} userToken={userToken!} />}

        {isAdmin && isPending && isOwnRequest && (
          <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            لا يمكنك اعتماد طلبك الخاص — يجب أن يقوم مدير آخر بمراجعته.
            {soloAdmin && ' لا يوجد مدير آخر في النظام حاليًا.'}
          </div>
        )}

        {isOwnRequest && isPending && <CancelLeaveButton id={id} userToken={userToken!} />}

        {isAdmin && <DeleteLeaveButton id={id} userToken={userToken!} />}
      </div>
    </div>
  );
};

export default SingleLeavePage;
