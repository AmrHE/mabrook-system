import { UNPAID_PERMIT_DAY_FRACTION, countIn, countNotIn, type LeaveLedgerEntry } from "./leaveLedger";

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export interface LeavePayroll {
  /** Distinct days with at least one shift. */
  attendedDays: number;
  /** Prorated working days expected of this employee in the window. */
  expectedDays: number;
  /** Approved PAID full-day leave not already worked — forgiven. */
  paidLeaveDays: number;
  /** Approved UNPAID full-day leave not already worked. */
  unpaidLeaveDays: number;
  /** Days carrying an approved UNPAID permit that the employee did attend. */
  unpaidPermitDays: number;
  /** Days the employer pays for: worked + paid leave, capped at expectedDays. */
  coveredDays: number;
  /** Uncovered expected days — no-shows *and* unpaid full-day leave. */
  absentDays: number;
  /** The slice of `absentDays` explained by approved unpaid leave. */
  unpaidLeaveChargedDays: number;
  /** The slice of `absentDays` with no request behind it at all. */
  unexcusedAbsentDays: number;
  dailyRate: number;
  unpaidLeaveDeduction: number;
  unexcusedAbsenceDeduction: number;
  permitDeduction: number;
  deduction: number;
  netSalary: number;
}

/**
 * The single payroll formula. Consumed by the salary report and the leave report
 * so the money and its attribution can never disagree.
 *
 * Business rules:
 *   - dailyRate = salary / 30 (fixed 30-day divisor)
 *   - a no-show on an expected day costs a full day
 *   - an approved UNPAID full-day leave costs a full day too — deliberately
 *     identical to a no-show
 *   - an approved UNPAID permit costs a flat 1/4 day, never pro-rated by minutes
 *   - an approved PAID request costs nothing
 *   - netSalary is clamped at 0
 *
 * Unpaid full-day leave carries no charge term of its own: by not being credited
 * into `coveredDays` it stays inside the `expectedDays - coveredDays` shortfall,
 * which is exactly the path a no-show takes. `unpaidLeaveChargedDays` then splits
 * that shortfall for reporting, without changing the total. One consequence: if
 * attendance already meets `expectedDays` the shortfall is zero and neither a
 * no-show nor an unpaid leave day is charged — the two stay equivalent, which is
 * the property the business asked for.
 *
 * Unpaid permits are charged only on days actually attended. Without that guard a
 * permit on a no-show day would bill a full day through the shortfall *plus* a
 * quarter day here — 1.25 days for a single absence.
 */
export function computeLeavePayroll({
  salary,
  expectedDays,
  attendedDayKeys,
  leave,
}: {
  salary: number;
  expectedDays: number;
  attendedDayKeys: Set<string>;
  leave: LeaveLedgerEntry;
}): LeavePayroll {
  const attendedDays = attendedDayKeys.size;

  // De-duplicated against days actually worked: a day the employee both took off
  // and checked in on must not be paid for twice.
  const paidLeaveDays = countNotIn(leave.paidLeaveDayKeys, attendedDayKeys);
  const unpaidLeaveDays = countNotIn(leave.unpaidLeaveDayKeys, attendedDayKeys);
  const unpaidPermitDays = countIn(leave.unpaidPermitDayKeys, attendedDayKeys);

  const dailyRate = round(salary / 30);
  const coveredDays = Math.min(expectedDays, attendedDays + paidLeaveDays);
  const absentDays = Math.max(0, expectedDays - coveredDays);

  // Split the shortfall into "authorised but unpaid" and "nobody asked".
  const unpaidLeaveChargedDays = Math.min(unpaidLeaveDays, absentDays);
  const unexcusedAbsentDays = absentDays - unpaidLeaveChargedDays;

  const unpaidLeaveDeduction = round(unpaidLeaveChargedDays * dailyRate);
  const unexcusedAbsenceDeduction = round(unexcusedAbsentDays * dailyRate);
  const permitDeduction = round(unpaidPermitDays * UNPAID_PERMIT_DAY_FRACTION * dailyRate);

  const deduction = round(absentDays * dailyRate + permitDeduction);
  const netSalary = Math.max(0, round(salary - deduction));

  return {
    attendedDays,
    expectedDays,
    paidLeaveDays,
    unpaidLeaveDays,
    unpaidPermitDays,
    coveredDays,
    absentDays,
    unpaidLeaveChargedDays,
    unexcusedAbsentDays,
    dailyRate,
    unpaidLeaveDeduction,
    unexcusedAbsenceDeduction,
    permitDeduction,
    deduction,
    netSalary,
  };
}
