/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/app/(internal)/visits/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import DateRangeFilter, { type ResolvedRange } from "@/components/DateRangeFilter";
import ExportButton from "@/components/ExportButton";
import FacetFilterBar, { applyFacetFilters, type FacetColumn, type FacetSelection } from "@/components/FacetFilterBar";
import LocationModal from "@/components/LocationModal";
import BankDetailsModal from "@/components/BankDetailsModal";
import type { CsvColumn } from "@/utils/export/toCsv";
import { TIMEZONE } from "@/utils/date/range";

const fmtDateTime = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }) : "";

// The salary tab is scoped to a single calendar month rather than the shared
// date-range filter. Riyadh is UTC+3 (no DST), so a month's absolute boundaries
// are its first day at 00:00 Riyadh (exclusive end = next month's first day).
const SALARY_TAB_KEY = "salary";

function monthKeyToRange(key: string): ResolvedRange {
  const [y, m] = key.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, -3, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 1, -3, 0, 0, 0));
  return { from: from.toISOString(), to: to.toISOString() };
}

// Last `count` months (current first), labelled with Gregorian Arabic names.
function buildMonthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "long",
    calendar: "gregory",
    timeZone: TIMEZONE,
  });
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: fmt.format(d) });
  }
  return out;
}

interface TabConfig {
  key: string;
  label: string;
  endpoint: string;
  extract: (json: any) => any[];
  transform?: (rows: any[]) => any[];
  columns: { key: string; header: string; cell?: (row: any) => ReactNode; sortable?: boolean }[];
  /**
   * CSV columns, when they should differ from what the table shows — e.g. a column
   * rendered as a modal trigger still needs its underlying fields in the export.
   * Defaults to `columns`.
   */
  exportColumns?: CsvColumn<any>[];
  filters?: FacetColumn[];
  filename: string;
}

const TABS: TabConfig[] = [
  {
    key: "moms",
    label: "الأمهات",
    endpoint: "/api/analytics/moms-rows",
    extract: (j) => j.rows || [],
    columns: [
      { key: "name", header: "الاسم" },
      { key: "nationality", header: "الجنسية" },
      { key: "phoneNumber", header: "الهاتف" },
      { key: "hospital", header: "المستشفى" },
      { key: "city", header: "المدينة" },
      { key: "employee", header: "الموظف" },
      { key: "numberOfnewborns", header: "المواليد" },
      { key: "numberOfMales", header: "ذكور" },
      { key: "numberOfFemales", header: "إناث" },
      { key: "twins", header: "توأم" },
      { key: "consent", header: "موافقة" },
      { key: "signature", header: "توقيع" },
      { key: "appInstalled", header: "تطبيق مثبّت" },
      { key: "installedApps", header: "التطبيقات" },
      { key: "createdAt", header: "التاريخ" },
    ],
    filters: [
      { key: "city", label: "المدينة" },
      { key: "nationality", label: "الجنسية" },
      { key: "hospital", label: "المستشفى" },
      { key: "employee", label: "الموظف" },
      { key: "twins", label: "توأم" },
      { key: "consent", label: "موافقة" },
      { key: "signature", label: "توقيع" },
      { key: "appInstalled", label: "تطبيق مثبّت" },
    ],
    filename: "moms.csv",
  },
  {
    key: "hospitals",
    label: "المستشفيات",
    endpoint: "/api/analytics/hospitals-ranking",
    extract: (j) => j.data || [],
    columns: [
      { key: "name", header: "المستشفى" },
      { key: "city", header: "المدينة" },
      { key: "district", header: "الحي" },
      { key: "moms", header: "الأمهات" },
      { key: "visitsCount", header: "الزيارات" },
      { key: "productsDistributed", header: "منتجات موزّعة" },
      { key: "stockUnits", header: "المخزون" },
    ],
    filters: [
      { key: "city", label: "المدينة" },
      { key: "district", label: "الحي" },
    ],
    filename: "hospitals.csv",
  },
  {
    key: "visits",
    label: "الزيارات",
    endpoint: "/api/analytics/visits-rows",
    extract: (j) => j.rows || [],
    columns: [
      { key: "hospital", header: "المستشفى" },
      { key: "city", header: "المدينة" },
      { key: "district", header: "الحي" },
      { key: "employee", header: "الموظف" },
      { key: "momsCount", header: "عدد الأمهات" },
      { key: "status", header: "الحالة" },
      { key: "startTime", header: "البداية" },
      { key: "endTime", header: "النهاية" },
      { key: "durationHours", header: "المدة (ساعات)" },
      { key: "momsPerHour", header: "أمهات/ساعة" },
      { key: "lowMomRateLabel", header: "إنتاجية منخفضة" },
      {
        // Merged location column (start = green, end = red); CSV exports the start coords.
        key: "startLocation",
        header: "الموقع",
        sortable: false,
        cell: (r) => (
          <LocationModal
            start={r.startLoc}
            end={r.endLoc}
            hospital={r.hospitalLoc}
            startLabel="بداية الزيارة"
            endLabel="نهاية الزيارة"
            title="موقع الزيارة"
            triggerText={r.startLocation || r.endLocation || undefined}
          />
        ),
      },
      {
        // Read-only here: the aggregation projects `_id: 0`, so there is no
        // visit id to PATCH. Editing lives on /visits and the visit detail page.
        key: "notes",
        header: "ملاحظات",
        sortable: false,
        cell: (r) => (
          <span className="block max-w-[220px] truncate" title={r.notes}>
            {r.notes || "—"}
          </span>
        ),
      },
    ],
    filters: [
      { key: "city", label: "المدينة" },
      { key: "district", label: "الحي" },
      { key: "hospital", label: "المستشفى" },
      { key: "employee", label: "الموظف" },
      { key: "status", label: "الحالة" },
      // Not `notes` — free text would explode the facet list.
      { key: "lowMomRateLabel", label: "إنتاجية منخفضة" },
    ],
    filename: "visits.csv",
  },
  {
    key: "employees",
    label: "الموظفون",
    endpoint: "/api/analytics/employees-report",
    extract: (j) => j.data || [],
    transform: (rows) =>
      rows.map((r) => ({
        ...r,
        hasOpenShift: r.hasOpenShift ? "نعم" : "لا",
        lastShiftStart: fmtDateTime(r.lastShiftStart),
      })),
    columns: [
      { key: "name", header: "الموظف" },
      { key: "email", header: "البريد" },
      { key: "moms", header: "الأمهات" },
      { key: "visits", header: "الزيارات" },
      { key: "sessionsCount", header: "الجلسات" },
      { key: "totalHours", header: "الساعات" },
      { key: "workingDays", header: "أيام العمل" },
      { key: "avgMomsPerDay", header: "معدل/يوم" },
      { key: "visitHours", header: "ساعات الزيارات" },
      { key: "momsPerVisitHour", header: "أمهات/ساعة زيارة" },
      { key: "lowMomRateVisits", header: "زيارات إنتاجية منخفضة" },
      { key: "appInstalls", header: "تثبيت التطبيقات" },
      { key: "momsWithApp", header: "أمهات بتطبيق" },
      { key: "hasOpenShift", header: "وردية مفتوحة" },
      { key: "lastShiftStart", header: "آخر وردية" },
    ],
    filters: [{ key: "hasOpenShift", label: "وردية مفتوحة" }],
    filename: "employees.csv",
  },
  {
    key: "products",
    label: "المنتجات",
    endpoint: "/api/analytics/products-consumption",
    extract: (j) => j.data || [],
    transform: (rows) => rows.map((r) => ({ ...r, lowStock: r.lowStock ? "نعم" : "لا" })),
    columns: [
      { key: "name", header: "المنتج" },
      { key: "distributed", header: "موزّع" },
      { key: "uniqueMoms", header: "أمهات فريدة" },
      { key: "warehouseQuantity", header: "المخزن" },
      { key: "hospitalsQuantity", header: "المستشفيات" },
      { key: "totalQuantity", header: "الإجمالي" },
      { key: "lowStock", header: "مخزون منخفض" },
    ],
    filters: [{ key: "lowStock", label: "مخزون منخفض" }],
    filename: "products.csv",
  },
  {
    key: "attendance",
    label: "الحضور والالتزام",
    endpoint: "/api/analytics/attendance-report",
    extract: (j) => j.data || [],
    transform: (rows) => rows.map((r) => ({ ...r, isOnShift: r.isOnShift ? "نعم" : "لا" })),
    columns: [
      { key: "name", header: "الموظف" },
      { key: "role", header: "الدور" },
      { key: "attendedDays", header: "أيام حضور" },
      { key: "expectedDays", header: "أيام متوقعة" },
      { key: "leaveDays", header: "أيام إجازة" },
      { key: "adherenceBase", header: "أيام مطلوبة فعليًا" },
      { key: "attendanceRate", header: "% حضور" },
      { key: "lateDays", header: "أيام تأخير" },
      { key: "excusedLateDays", header: "تأخير باستئذان" },
      { key: "lateRate", header: "% تأخير" },
      { key: "avgStartTime", header: "متوسط البدء" },
      { key: "totalHours", header: "الساعات" },
      { key: "hoursMetRate", header: "% إنجاز الساعات" },
      { key: "sessionsCount", header: "الجلسات" },
      { key: "avgVisitsPerDay", header: "زيارات/يوم" },
      { key: "avgMomsPerDay", header: "أمهات/يوم" },
      { key: "autoClosedRate", header: "% جلسات أُغلقت تلقائياً" },
      { key: "forgotDaysRate", header: "% أيام بدون إنهاء" },
      { key: "pendingRequests", header: "طلبات معلّقة" },
      { key: "isOnShift", header: "في الدوام" },
    ],
    filters: [
      { key: "role", label: "الدور" },
      { key: "isOnShift", label: "في الدوام" },
    ],
    filename: "attendance.csv",
  },
  {
    key: "salary",
    label: "تقرير الرواتب الشهري",
    endpoint: "/api/analytics/salary-report",
    extract: (j) => j.data || [],
    columns: [
      { key: "name", header: "الموظف" },
      // { key: "role", header: "الدور" },
      { key: "salary", header: "الراتب الكامل" },
      { key: "attendedDays", header: "أيام العمل" },
      { key: "expectedDays", header: "أيام العمل المتوقعة" },
      { key: "paidLeaveDays", header: "إجازة مدفوعة" },
      { key: "unpaidLeaveDays", header: "إجازة غير مدفوعة" },
      { key: "absentDays", header: "أيام الغياب" },
      { key: "unexcusedAbsentDays", header: "غياب بدون إذن" },
      { key: "unpaidPermitDays", header: "استئذان غير مدفوع" },
      { key: "lateDays", header: "أيام التأخير" },
      { key: "attendanceRate", header: "% الحضور" },
      // { key: "dailyRate", header: "قيمة اليوم" },
      // { key: "permitDeduction", header: "خصم الاستئذان" },
      { key: "deduction", header: "إجمالي الخصم" },
      { key: "netSalary", header: "المبلغ المستحق" },
      {
        // Banking details collapse into one CTA — the IBAN is too wide to sit in
        // the table, and the CSV below still carries both fields separately.
        key: "bankName",
        header: "بيانات بنكية",
        sortable: false,
        cell: (r) => (
          <BankDetailsModal
            employeeName={r.name}
            bankName={r.bankName}
            iban={r.iban}
            netSalary={r.netSalary}
          />
        ),
      },
    ],
    // A payroll file handed to the bank needs the IBAN and bank name as real
    // columns, not the trigger label the table shows.
    exportColumns: [
      { key: "name", header: "الموظف" },
      { key: "salary", header: "الراتب الكامل" },
      { key: "attendedDays", header: "أيام العمل" },
      { key: "expectedDays", header: "أيام العمل المتوقعة" },
      { key: "paidLeaveDays", header: "إجازة مدفوعة" },
      { key: "unpaidLeaveDays", header: "إجازة غير مدفوعة" },
      { key: "absentDays", header: "أيام الغياب" },
      { key: "unexcusedAbsentDays", header: "غياب بدون إذن" },
      { key: "unpaidPermitDays", header: "استئذان غير مدفوع" },
      { key: "lateDays", header: "أيام التأخير" },
      { key: "attendanceRate", header: "% الحضور" },
      { key: "deduction", header: "إجمالي الخصم" },
      { key: "netSalary", header: "المبلغ المستحق" },
      { key: "iban", header: "الآيبان" },
      { key: "bankName", header: "البنك" },
    ],
    filters: [
      { key: "role", label: "الدور" },
      { key: "project", label: "المشروع" },
    ],
    filename: "salary.csv",
  },
  {
    key: "leaves",
    label: "الإجازات والاستئذانات",
    endpoint: "/api/analytics/leave-report",
    extract: (j) => j.data || [],
    columns: [
      { key: "name", header: "الموظف" },
      { key: "role", header: "الدور" },
      { key: "project", header: "المشروع" },
      { key: "totalLeaveDays", header: "إجمالي أيام الإجازة" },
      { key: "paidLeaveDays", header: "مدفوعة" },
      { key: "unpaidLeaveDays", header: "غير مدفوعة" },
      { key: "delayPermitDays", header: "استئذان تأخير" },
      { key: "earlyLeaveDays", header: "انصراف مبكر" },
      { key: "unpaidPermitDays", header: "استئذان غير مدفوع" },
      { key: "excusedMinutes", header: "دقائق مستأذنة" },
      { key: "approvedRequests", header: "طلبات معتمدة" },
      { key: "pendingRequests", header: "طلبات معلّقة" },
      { key: "rejectedRequests", header: "طلبات مرفوضة" },
      { key: "unpaidLeaveDeduction", header: "خصم الإجازات" },
      { key: "permitDeduction", header: "خصم الاستئذان" },
      { key: "leaveDeduction", header: "إجمالي خصم الاستئذانات" },
    ],
    filters: [
      { key: "role", label: "الدور" },
      { key: "project", label: "المشروع" },
    ],
    filename: "leaves.csv",
  },
  {
    key: "leave-requests",
    label: "طلبات الاستئذان",
    endpoint: "/api/analytics/leave-rows",
    extract: (j) => j.rows || [],
    columns: [
      { key: "employee", header: "الموظف" },
      { key: "role", header: "الدور" },
      { key: "project", header: "المشروع" },
      { key: "type", header: "النوع" },
      { key: "startDay", header: "من" },
      { key: "endDay", header: "إلى" },
      { key: "daysCount", header: "عدد الأيام" },
      { key: "duration", header: "المدة" },
      { key: "status", header: "الحالة" },
      { key: "payMode", header: "مدفوع؟" },
      { key: "reason", header: "السبب" },
      { key: "decidedByName", header: "تم القرار بواسطة" },
      { key: "decisionNote", header: "ملاحظة القرار" },
      { key: "decidedAt", header: "تاريخ القرار" },
      { key: "createdAt", header: "تاريخ الطلب" },
    ],
    filters: [
      { key: "type", label: "النوع" },
      { key: "status", label: "الحالة" },
      { key: "payMode", label: "مدفوع؟" },
      { key: "role", label: "الدور" },
      { key: "employee", label: "الموظف" },
    ],
    filename: "leave-requests.csv",
  },
  {
    key: "demographics",
    label: "الجنسيات",
    endpoint: "/api/analytics/demographics",
    extract: (j) => j.nationality?.breakdown || [],
    columns: [
      { key: "label", header: "الجنسية" },
      { key: "count", header: "العدد" },
      { key: "futureContactRate", header: "متوسط الموافقة على التواصل %", cell: (r) => `${r.futureContactRate ?? 0}%` },
    ],
    filename: "demographics.csv",
  },
  {
    key: "apps",
    label: "التطبيقات",
    endpoint: "/api/analytics/app-adoption",
    extract: (j) => j.byApp || [],
    columns: [
      { key: "name", header: "التطبيق" },
      { key: "moms", header: "عدد الأمهات المثبّتات" },
    ],
    filename: "apps.csv",
  },
];

export default function ReportsClient({ userToken }: { userToken?: string }) {
  const [range, setRange] = useState<ResolvedRange | null>(null);
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [rowsByKey, setRowsByKey] = useState<Record<string, any[]>>({});
  const [facetSel, setFacetSel] = useState<Record<string, FacetSelection>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = useMemo(() => buildMonthOptions(12), []);
  const [salaryMonth, setSalaryMonth] = useState(monthOptions[0].value);
  const monthRange = useMemo(() => monthKeyToRange(salaryMonth), [salaryMonth]);

  // The salary tab uses its own month picker; every other tab uses the shared range.
  const rangeForTab = (key: string): ResolvedRange | null => (key === SALARY_TAB_KEY ? monthRange : range);
  const keyForTab = (key: string): string => {
    const r = rangeForTab(key);
    return r ? `${key}|${r.from}|${r.to}` : "";
  };

  const activeRange = rangeForTab(activeTab);
  const cacheKey = keyForTab(activeTab);

  // Read latest cache inside the effect without making it a dependency.
  const rowsByKeyRef = useRef(rowsByKey);
  rowsByKeyRef.current = rowsByKey;

  useEffect(() => {
    if (!activeRange) return;
    if (rowsByKeyRef.current[cacheKey]) return;
    const tab = TABS.find((t) => t.key === activeTab)!;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = `from=${encodeURIComponent(activeRange.from)}&to=${encodeURIComponent(activeRange.to)}`;
        const res = await fetch(`${tab.endpoint}?${qs}`, { headers: { authorization: `Bearer ${userToken}` } });
        if (!res.ok) throw new Error(`فشل تحميل التقرير (${res.status})`);
        const json = await res.json();
        let rows = tab.extract(json);
        if (tab.transform) rows = tab.transform(rows);
        if (!cancelled) setRowsByKey((prev) => ({ ...prev, [cacheKey]: rows }));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "تعذّر تحميل التقرير");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, userToken]);

  return (
    <div>
      <div className="flex md:items-center flex-col md:flex-row justify-between mb-6 gap-4">
        <h1 className="font-bold text-3xl">التقارير</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={activeTab === SALARY_TAB_KEY ? "hidden" : ""}>
            <DateRangeFilter defaultPreset="6months" onChange={setRange} />
          </div>
          {activeTab === SALARY_TAB_KEY && (
            <Select value={salaryMonth} onValueChange={setSalaryMonth}>
              <SelectTrigger className="w-[180px] bg-white border border-gray-300 rounded-lg">
                <SelectValue placeholder="اختر الشهر" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs dir="rtl" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => {
          const tKey = keyForTab(t.key);
          const tRows = rowsByKey[tKey] || [];
          const sel = facetSel[t.key] ?? {};
          const displayedRows = t.filters?.length ? applyFacetFilters(tRows, sel) : tRows;
          const tCols: ColumnDef<any>[] = t.columns.map((c) => ({
            accessorKey: c.key,
            header: c.header,
            ...(c.sortable === false ? { enableSorting: false } : {}),
            ...(c.cell ? { cell: ({ row }: { row: { original: any } }) => c.cell!(row.original) } : {}),
          }));
          const isActive = t.key === activeTab;
          return (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              {t.filters?.length && !(isActive && (loading || error)) ? (
                <FacetFilterBar
                  rows={tRows}
                  facets={t.filters}
                  selected={sel}
                  onChange={(next) => setFacetSel((s) => ({ ...s, [t.key]: next }))}
                  className="mb-3"
                />
              ) : null}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {isActive && loading ? "جارٍ التحميل..." : `${displayedRows.length} من ${tRows.length} صف`}
                </p>
                <ExportButton
                  rows={displayedRows}
                  columns={t.exportColumns ?? (t.columns as CsvColumn<any>[])}
                  filename={t.filename}
                />
              </div>
              {isActive && error ? (
                <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
              ) : isActive && loading ? (
                <Skeleton className="w-full h-[400px]" />
              ) : (
                <div className="overflow-x-auto">
                  <DataTable columns={tCols} data={displayedRows} />
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
