/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DateRangeFilter, { type ResolvedRange } from "@/components/DateRangeFilter";
import FilterableTable from "@/components/FilterableTable";
import LocationModal from "@/components/LocationModal";
import FenceBadge from "@/components/FenceBadge";
import { fenceStatusLabel } from "@/utils/geo/geofence";
import type { ColumnDef } from "@tanstack/react-table";
import type { CsvColumn } from "@/utils/export/toCsv";
import MomsTrendChart from "@/components/charts/MomsTrendChart";
import HospitalsBarChart from "@/components/charts/HospitalsBarChart";
import EmployeesBarChart from "@/components/charts/EmployeesBarChart";
import ProductsConsumptionChart from "@/components/charts/ProductsConsumptionChart";
import NationalityPieChart from "@/components/charts/NationalityPieChart";
import GenderDonut from "@/components/charts/GenderDonut";
import MultipleBirthsChart from "@/components/charts/MultipleBirthsChart";
import MetricBarChart from "@/components/charts/MetricBarChart";
import StackedBarChart from "@/components/charts/StackedBarChart";
import MatrixHeatTable from "@/components/charts/MatrixHeatTable";
import BoxTrendChart from "@/components/charts/BoxTrendChart";
import TreemapChart from "@/components/charts/TreemapChart";
import EmployeeRadar from "@/components/charts/EmployeeRadar";
import SynchronizedAreaChart from "@/components/charts/SynchronizedAreaChart";
import DataQualityPanel from "@/components/charts/DataQualityPanel";
import AttentionPanel from "@/components/charts/AttentionPanel";
import DeltaBadge from "@/components/charts/DeltaBadge";
import { CHART_COLORS, computeDelta, fmtNumber, pct, type Delta, type Granularity } from "@/components/charts/constants";

// Leaflet must never run on the server.
const VisitCoverageMap = dynamic(() => import("@/components/charts/VisitCoverageMap"), { ssr: false });
const ShiftLocationMap = dynamic(() => import("@/components/charts/ShiftLocationMap"), { ssr: false });

const qs = (r: ResolvedRange) => `from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;

/** Fetch JSON from an analytics endpoint; skips when `url` is null. */
function useJson<T = any>(url: string | null, userToken?: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url, { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`فشل تحميل البيانات (${r.status})`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "تعذّر تحميل البيانات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, userToken]);

  return { data, loading, error };
}

interface TabProps {
  userToken?: string;
  range: ResolvedRange | null;
}

/* ---------- UI helpers ---------- */

const ChartCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card>
    <CardHeader className="pb-0">
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const ChartSkeleton = () => <Skeleton className="w-full h-[300px]" />;

function ChartSlot({ busy, error, children }: { busy: boolean; error: string | null; children: ReactNode }) {
  if (error) return <div className="flex h-[260px] items-center justify-center text-sm text-red-600">{error}</div>;
  if (busy) return <ChartSkeleton />;
  return <>{children}</>;
}

const StatChip = ({
  label,
  value,
  loading,
  share,
  delta,
}: {
  label: string;
  value?: number | string;
  loading: boolean;
  /** Contextual share of a natural whole, e.g. `{ pct: 12, of: "من الأمهات" }`. */
  share?: { pct: number; of: string } | null;
  /** Period-over-period change vs. the previous window. */
  delta?: Delta | null;
}) => (
  <div className="bg-white rounded-xl border px-4 py-3">
    <p className="text-xs text-gray-500">{label}</p>
    {loading ? (
      <Skeleton className="h-6 w-12 mt-1" />
    ) : (
      <>
        <div className="flex items-baseline gap-2">
          <p className="font-bold text-xl">{typeof value === "number" ? fmtNumber(value) : value ?? "—"}</p>
          <DeltaBadge delta={delta} />
        </div>
        {share && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {share.pct}% {share.of}
          </p>
        )}
      </>
    )}
  </div>
);

/* ---------- tabs ---------- */

function MomsTab({ userToken, range }: TabProps) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const query = range ? qs(range) : null;
  const { data: ov, error: ovErr } = useJson<any>(query ? `/api/analytics/overview?${query}` : null, userToken);
  const { data: ts, error: tsErr } = useJson<any>(
    query ? `/api/analytics/moms-timeseries?${query}&granularity=${granularity}` : null,
    userToken,
  );
  const { data: demo, error: demoErr } = useJson<any>(query ? `/api/analytics/demographics?${query}` : null, userToken);
  const { data: apps, error: appsErr } = useJson<any>(query ? `/api/analytics/app-adoption?${query}` : null, userToken);
  const cur = ov?.current;
  const prev = ov?.previous;
  const ovBusy = !ov && !ovErr;
  const appsBusy = !apps && !appsErr;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="الأمهات" value={cur?.moms} loading={ovBusy} delta={computeDelta(cur?.moms, prev?.moms)} />
        <StatChip label="المواليد" value={cur?.newborns} loading={ovBusy} delta={computeDelta(cur?.newborns, prev?.newborns)} />
        <StatChip
          label="توائم فأكثر"
          value={cur?.twinsPlus}
          loading={ovBusy}
          share={cur ? { pct: pct(cur.twinsPlus, cur.moms), of: "من الأمهات" } : null}
        />
        <StatChip
          label="موافقات تواصل"
          value={cur?.consent}
          loading={ovBusy}
          share={cur ? { pct: pct(cur.consent, cur.moms), of: "من الأمهات" } : null}
        />
        <StatChip label="ثبّتن تطبيقاً" value={apps?.summary?.momsWithApp} loading={appsBusy} share={apps?.summary ? { pct: apps.summary.adoptionRate ?? 0, of: "من الأمهات" } : null} />
        <StatChip label="إجمالي التثبيتات" value={apps?.summary?.totalInstalls} loading={appsBusy} />
      </div>
      <ChartCard title="اتجاه تسجيل الأمهات">
        <ChartSlot busy={!ts && !tsErr} error={tsErr}>
          <MomsTrendChart data={ts?.data || []} granularity={granularity} onGranularityChange={setGranularity} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="الأمهات حسب الجنسية">
        <ChartSlot busy={!demo && !demoErr} error={demoErr}>
          <MetricBarChart
            data={demo?.nationality?.breakdown || []}
            nameKey="label"
            valueKey="count"
            seriesName="أمهات"
            color={CHART_COLORS.primary}
            topN={12}
            percentOfTotal
          />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="الأمهات حسب الفئة العمرية">
        <ChartSlot busy={!demo && !demoErr} error={demoErr}>
          <MetricBarChart
            data={demo?.ageGroups || []}
            nameKey="label"
            valueKey="count"
            seriesName="أمهات"
            layout="horizontal"
            sort={false}
            color={CHART_COLORS.teal}
            percentOfTotal
          />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="الأمهات حسب التطبيق المثبّت">
        <ChartSlot busy={appsBusy} error={appsErr}>
          <MetricBarChart data={apps?.byApp || []} nameKey="name" valueKey="moms" seriesName="أمهات" color={CHART_COLORS.purple} topN={12} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="مثبّتات التطبيق حسب الجنسية">
        <ChartSlot busy={appsBusy} error={appsErr}>
          <MetricBarChart data={apps?.byNationality || []} nameKey="label" valueKey="withApp" seriesName="أمهات ثبّتن تطبيقاً" color={CHART_COLORS.orange} topN={12} percentOfTotal />
        </ChartSlot>
      </ChartCard>
    </div>
  );
}

function HospitalsTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const { data: resp, error } = useJson<any>(query ? `/api/analytics/hospitals-ranking?${query}` : null, userToken);
  const rows = resp?.data || [];
  const busy = !resp && !error;
  const treemap = rows.map((r: any) => ({ name: r.name, size: r.moms }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="الأكثر استقبالاً للأمهات">
        <ChartSlot busy={busy} error={error}>
          <HospitalsBarChart data={rows} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="المنتجات الموزّعة حسب المستشفى">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="productsDistributed" seriesName="منتجات موزّعة" color={CHART_COLORS.teal} topN={8} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="موافقات التواصل حسب المستشفى">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="consent" seriesName="موافقات" color={CHART_COLORS.green} topN={8} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="حصة المستشفيات (حسب الأمهات)">
        <ChartSlot busy={busy} error={error}>
          <TreemapChart data={treemap} />
        </ChartSlot>
      </ChartCard>
    </div>
  );
}

function EmployeesTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const { data: report, error } = useJson<any>(query ? `/api/analytics/employees-report?${query}` : null, userToken);
  const rows = report?.data || [];
  const busy = !report && !error;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="الأداء (أمهات / زيارات)">
        <ChartSlot busy={busy} error={error}>
          <EmployeesBarChart data={rows} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="ساعات العمل">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="totalHours" seriesName="ساعات" color={CHART_COLORS.green} topN={10} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="الإنتاجية (أمهات/ساعة)">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="momsPerHour" seriesName="أمهات/ساعة" color={CHART_COLORS.purple} topN={10} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="نسبة التوقيع حسب الموظف">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="signatureRate" seriesName="% توقيع" color={CHART_COLORS.orange} topN={10} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="تثبيت التطبيقات حسب الموظف">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="appInstalls" seriesName="تثبيتات" color={CHART_COLORS.teal} topN={10} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="توزيع المنتجات حسب الموظف">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={rows} nameKey="name" valueKey="productsDistributed" seriesName="منتجات موزّعة" color={CHART_COLORS.primary} topN={10} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="أفضل 3 موظفين مقابل المتوسط">
          <ChartSlot busy={busy} error={error}>
            <EmployeeRadar data={rows} range={range} variant="top" count={3} />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="أضعف 3 موظفين مقابل المتوسط">
          <ChartSlot busy={busy} error={error}>
            <EmployeeRadar data={rows} range={range} variant="bottom" count={3} />
          </ChartSlot>
        </ChartCard>
      </div>
    </div>
  );
}

function ProductsTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const [trendGran, setTrendGran] = useState<Granularity>("day");
  const { data: resp, error } = useJson<any>(query ? `/api/analytics/products-consumption?${query}` : null, userToken);
  const { data: inv, error: invErr } = useJson<any>(query ? `/api/analytics/inventory-projection?${query}` : null, userToken);
  const { data: survey, error: surveyErr } = useJson<any>(query ? `/api/analytics/survey-completion?${query}` : null, userToken);
  const { data: top, error: topErr } = useJson<any>(query ? `/api/analytics/top-distributors?${query}` : null, userToken);
  const { data: matrix, error: matrixErr } = useJson<any>(query ? `/api/analytics/box-employee-breakdown?${query}` : null, userToken);
  const { data: stock, error: stockErr } = useJson<any>(`/api/analytics/stock-matrix`, userToken);
  const { data: trend, error: trendErr } = useJson<any>(
    query ? `/api/analytics/box-distribution-timeseries?${query}&granularity=${trendGran}` : null,
    userToken,
  );
  const rows = resp?.data || [];
  const busy = !resp && !error;
  const burnRows = (inv?.data || []).filter((d: any) => d.daysToStockout != null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="الأكثر توزيعاً">
        <ChartSlot busy={busy} error={error}>
          <ProductsConsumptionChart data={rows} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="الموظفون الأكثر توزيعاً للصناديق">
        <ChartSlot busy={!top && !topErr} error={topErr}>
          <MetricBarChart data={top?.data || []} nameKey="name" valueKey="boxes" seriesName="صناديق" color={CHART_COLORS.primary} topN={10} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="أيام حتى نفاد المخزون (تقدير)">
        <ChartSlot busy={!inv && !invErr} error={invErr}>
          <MetricBarChart data={burnRows} nameKey="name" valueKey="daysToStockout" seriesName="أيام" color={CHART_COLORS.red} topN={10} sort={false} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="نسبة إكمال الاستبيان حسب الصندوق">
        <ChartSlot busy={!survey && !surveyErr} error={surveyErr}>
          <MetricBarChart data={survey?.perProduct || []} nameKey="name" valueKey="rate" seriesName="% إكمال" color={CHART_COLORS.green} topN={10} />
        </ChartSlot>
      </ChartCard>
      <div className="lg:col-span-2">
        <ChartCard title="اتجاه توزيع الصناديق عبر الوقت">
          <ChartSlot busy={!trend && !trendErr} error={trendErr}>
            <BoxTrendChart
              points={trend?.points || []}
              boxes={trend?.boxes || []}
              granularity={trendGran}
              onGranularityChange={setTrendGran}
            />
          </ChartSlot>
        </ChartCard>
      </div>
      <div className="lg:col-span-2">
        <ChartCard title="المخزون المتبقي حسب المستشفى والصندوق">
          <ChartSlot busy={!stock && !stockErr} error={stockErr}>
            <MatrixHeatTable
              rowHeader="المستشفى"
              valueNoun="وحدة"
              rows={(stock?.hospitals || []).map((h: any) => ({ id: h.id, name: h.name }))}
              cols={(stock?.boxes || []).map((b: any) => ({ id: b.id, name: b.name }))}
              cells={(stock?.cells || []).map((c: any) => ({ rowId: String(c.hospitalId), colId: String(c.boxId), value: c.quantity }))}
            />
          </ChartSlot>
        </ChartCard>
      </div>
      <div className="lg:col-span-2">
        <ChartCard title="توزيع الصناديق حسب الموظف">
          <ChartSlot busy={!matrix && !matrixErr} error={matrixErr}>
            <MatrixHeatTable
              rowHeader="الصندوق"
              valueNoun="صندوق"
              rows={(matrix?.boxes || []).map((b: any) => ({ id: b.id, name: b.name }))}
              cols={(matrix?.employees || []).map((e: any) => ({ id: e.id, name: e.name }))}
              cells={(matrix?.cells || []).map((c: any) => ({ rowId: String(c.boxId), colId: String(c.employeeId), value: c.count }))}
            />
          </ChartSlot>
        </ChartCard>
      </div>
    </div>
  );
}

function ShiftsTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const { data: report, error: repErr } = useJson<any>(query ? `/api/analytics/employees-report?${query}` : null, userToken);
  const { data: patterns, error: patErr } = useJson<any>(query ? `/api/analytics/shift-patterns?${query}` : null, userToken);
  const { data: durations, error: durErr } = useJson<any>(query ? `/api/analytics/visit-durations?${query}` : null, userToken);
  const { data: open, error: openErr } = useJson<any>(query ? `/api/analytics/open-shifts` : null, userToken);
  const rows = report?.data || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="ساعات العمل للموظفين">
        <ChartSlot busy={!report && !repErr} error={repErr}>
          <MetricBarChart data={rows} nameKey="name" valueKey="totalHours" seriesName="ساعات" color={CHART_COLORS.green} topN={10} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="أيام العمل للموظفين">
        <ChartSlot busy={!report && !repErr} error={repErr}>
          <MetricBarChart data={rows} nameKey="name" valueKey="workingDays" seriesName="أيام" color={CHART_COLORS.orange} topN={10} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="توزيع ساعة بدء الدوام">
        <ChartSlot busy={!patterns && !patErr} error={patErr}>
          <MetricBarChart data={patterns?.byStartHour || []} nameKey="hour" valueKey="count" seriesName="ورديات" layout="horizontal" sort={false} color={CHART_COLORS.primary} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="توزيع مدة الزيارة">
        <ChartSlot busy={!durations && !durErr} error={durErr}>
          <MetricBarChart data={durations?.bins || []} nameKey="label" valueKey="count" seriesName="زيارات" layout="horizontal" sort={false} color={CHART_COLORS.teal} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <div className="lg:col-span-2">
        <ChartCard title="⚠ دوام لم يُغلق">
          <ChartSlot busy={!open && !openErr} error={openErr}>
            <AttentionPanel openShifts={open?.data || []} products={[]} />
          </ChartSlot>
        </ChartCard>
      </div>
    </div>
  );
}

function DemographicsTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const { data: demo, error } = useJson<any>(query ? `/api/analytics/demographics?${query}` : null, userToken);
  const busy = !demo && !error;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="الجنسيات (سعودي / غير سعودي)">
        <ChartSlot busy={busy} error={error}>
          <NationalityPieChart data={demo?.nationality} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="أكثر الجنسيات">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={demo?.nationality?.breakdown || []} nameKey="label" valueKey="count" seriesName="أمهات" color={CHART_COLORS.purple} topN={10} percentOfTotal />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="جنس المواليد">
        <ChartSlot busy={busy} error={error}>
          <GenderDonut data={demo?.gender} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="تعدد المواليد">
        <ChartSlot busy={busy} error={error}>
          <MultipleBirthsChart data={demo?.births} />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="عدد الأطفال لكل أم">
        <ChartSlot busy={busy} error={error}>
          <MetricBarChart data={demo?.kidsPerMom || []} nameKey="kids" valueKey="count" seriesName="أمهات" layout="horizontal" sort={false} color={CHART_COLORS.slate} percentOfTotal />
        </ChartSlot>
      </ChartCard>
    </div>
  );
}

function GeographyTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const { data: loc, error: locErr } = useJson<any>(query ? `/api/analytics/visit-locations?${query}` : null, userToken);
  const { data: geo, error: geoErr } = useJson<any>(query ? `/api/analytics/geo-breakdown?${query}` : null, userToken);

  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard title="خريطة تغطية الزيارات">
        <ChartSlot busy={!loc && !locErr} error={locErr}>
          <VisitCoverageMap data={loc?.data || []} />
        </ChartSlot>
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="الأمهات حسب المدينة">
          <ChartSlot busy={!geo && !geoErr} error={geoErr}>
            <MetricBarChart data={geo?.cities || []} nameKey="name" valueKey="moms" seriesName="أمهات" color={CHART_COLORS.primary} topN={12} percentOfTotal />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="الأمهات حسب الحي">
          <ChartSlot busy={!geo && !geoErr} error={geoErr}>
            <MetricBarChart data={geo?.districts || []} nameKey="name" valueKey="moms" seriesName="أمهات" color={CHART_COLORS.teal} topN={12} percentOfTotal />
          </ChartSlot>
        </ChartCard>
      </div>
    </div>
  );
}

function FunnelQualityTab({ userToken, range }: TabProps) {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const query = range ? qs(range) : null;
  const { data: conv, error: convErr } = useJson<any>(
    query ? `/api/analytics/conversion-timeseries?${query}&granularity=${granularity}` : null,
    userToken,
  );
  const { data: survey, error: surveyErr } = useJson<any>(query ? `/api/analytics/survey-completion?${query}` : null, userToken);
  const { data: dq, error: dqErr } = useJson<any>(query ? `/api/analytics/data-quality?${query}` : null, userToken);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="تحوّل الحملة عبر الزمن">
        <ChartSlot busy={!conv && !convErr} error={convErr}>
          <SynchronizedAreaChart
            data={conv?.data || []}
            granularity={granularity}
            onGranularityChange={setGranularity}
            series={[
              { key: "moms", label: "الأمهات", color: CHART_COLORS.primary },
              { key: "consent", label: "وافقوا على التواصل", color: CHART_COLORS.green },
              { key: "signed", label: "موقّعة", color: CHART_COLORS.orange },
              { key: "surveyed", label: "أكملوا الاستبيان", color: CHART_COLORS.teal },
            ]}
          />
        </ChartSlot>
      </ChartCard>
      <ChartCard title="نسبة إكمال الاستبيان حسب المنتج">
        <ChartSlot busy={!survey && !surveyErr} error={surveyErr}>
          <div className="space-y-3">
            <StatChip
              label="نسبة الإكمال الإجمالية"
              value={survey ? `${survey.overall?.rate ?? 0}%` : undefined}
              loading={!survey && !surveyErr}
            />
            <MetricBarChart data={survey?.perProduct || []} nameKey="name" valueKey="rate" seriesName="% إكمال" color={CHART_COLORS.green} topN={10} height={220} />
          </div>
        </ChartSlot>
      </ChartCard>
      <div className="lg:col-span-2">
        <ChartCard title="جودة البيانات">
          <ChartSlot busy={!dq && !dqErr} error={dqErr}>
            <DataQualityPanel stats={dq} range={range} />
          </ChartSlot>
        </ChartCard>
      </div>
    </div>
  );
}

const CLOSE_REASON_AR: Record<string, string> = {
  MANUAL: "يدوي",
  LOGOUT: "تسجيل خروج",
  MAX_DURATION: "تجاوز المدة",
  INACTIVITY: "خمول",
  DUPLICATE: "مكرر",
};

const fmtDT = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "—";

const minutesToHHMM = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function AttendanceTab({ userToken, range }: TabProps) {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const query = range ? qs(range) : null;
  const { data: report, error: repErr } = useJson<any>(query ? `/api/analytics/attendance-report?${query}` : null, userToken);
  const { data: ts, error: tsErr } = useJson<any>(
    query ? `/api/analytics/attendance-timeseries?${query}&granularity=${granularity}` : null,
    userToken,
  );
  const { data: detail, error: detErr } = useJson<any>(query ? `/api/analytics/shifts-detail?${query}` : null, userToken);
  const { data: open, error: openErr } = useJson<any>(`/api/analytics/open-shifts`, userToken);
  const { data: leave, error: leaveErr } = useJson<any>(
    query ? `/api/analytics/leave-breakdown?${query}&granularity=${granularity}` : null,
    userToken,
  );

  const rep: any[] = report?.data || [];
  const repBusy = !report && !repErr;
  const leaveBusy = !leave && !leaveErr;
  const lv = leave?.summary;

  // Org-wide KPIs derived from the per-employee rows.
  const onShiftCount = rep.filter((r) => r.isOnShift).length;
  const totalAttended = rep.reduce((s, r) => s + (r.attendedDays || 0), 0);
  // Lateness already excludes days covered by an approved delay permit.
  const totalLate = rep.reduce((s, r) => s + (r.lateDays || 0), 0);
  const onTimeRate = totalAttended ? Math.round((1 - totalLate / totalAttended) * 100) : 0;
  const avgAttendance = rep.length ? Math.round(rep.reduce((s, r) => s + (r.attendanceRate || 0), 0) / rep.length) : 0;
  const totalHours = Math.round(rep.reduce((s, r) => s + (r.totalHours || 0), 0));
  const autoClosed = rep.reduce((s, r) => s + (r.autoClosedShifts || 0), 0);
  let startMinTotal = 0;
  let startWeight = 0;
  for (const r of rep) {
    if (r.attendedDays > 0 && typeof r.avgStartTime === "string" && r.avgStartTime.includes(":")) {
      const [h, m] = r.avgStartTime.split(":").map(Number);
      startMinTotal += (h * 60 + m) * r.attendedDays;
      startWeight += r.attendedDays;
    }
  }
  const avgStart = startWeight ? minutesToHHMM(startMinTotal / startWeight) : "—";

  // Check-in map points + per-shift table rows from the detail endpoint.
  const det: any[] = detail?.data || [];
  const mapPoints = det
    .filter((d) => d.startLocation && Number.isFinite(d.startLocation.lat) && Number.isFinite(d.startLocation.lng))
    .map((d) => ({
      lat: d.startLocation.lat,
      lng: d.startLocation.lng,
      employee: d.employee || "غير محدد",
      time: fmtDT(d.startTime),
      onTime: !!d.onTime,
    }));

  const tableRows = det.map((d) => ({
    id: d.shiftId,
    employee: d.employee || "غير محدد",
    start: fmtDT(d.startTime),
    end: fmtDT(d.endTime),
    durationHours: d.durationHours ?? "—",
    visitsCount: d.visitsCount ?? 0,
    momsCount: d.momsCount ?? 0,
    productsCount: d.productsCount ?? 0,
    onTime: d.onTime ? "في الوقت" : "متأخر",
    startLocation: d.startLocation ?? null,
    endLocation: d.endLocation ?? null,
    locationText:
      d.startLocation && Number.isFinite(d.startLocation.lat)
        ? `${d.startLocation.lat.toFixed(4)}, ${d.startLocation.lng.toFixed(4)}`
        : "",
    fenceStatus: d.startFenceStatus,
    fenceDistance: d.startDistanceMeters ?? null,
    fenceLabel: fenceStatusLabel(d.startFenceStatus),
    autoClosed: d.autoClosed ? "نعم" : "لا",
    closeReason: d.closeReason ? CLOSE_REASON_AR[d.closeReason] ?? d.closeReason : "",
  }));

  const shiftCols: ColumnDef<any, any>[] = [
    { accessorKey: "employee", header: "الموظف" },
    { accessorKey: "start", header: "البداية" },
    { accessorKey: "end", header: "النهاية" },
    { accessorKey: "durationHours", header: "المدة (س)" },
    { accessorKey: "visitsCount", header: "زيارات" },
    { accessorKey: "momsCount", header: "أمهات" },
    { accessorKey: "productsCount", header: "منتجات" },
    { accessorKey: "onTime", header: "الالتزام" },
    {
      accessorKey: "locationText",
      header: "الموقع",
      cell: ({ row }) => (
        <LocationModal
          start={row.original.startLocation}
          end={row.original.endLocation}
          triggerText={row.original.locationText || undefined}
        />
      ),
    },
    {
      id: "fence",
      header: "حالة الموقع",
      enableSorting: false,
      cell: ({ row }) => <FenceBadge status={row.original.fenceStatus} distanceMeters={row.original.fenceDistance} />,
    },
    { accessorKey: "autoClosed", header: "إغلاق تلقائي" },
    { accessorKey: "closeReason", header: "سبب الإغلاق" },
  ];
  const shiftExportCols: CsvColumn<any>[] = [
    { key: "employee", header: "الموظف" },
    { key: "start", header: "البداية" },
    { key: "end", header: "النهاية" },
    { key: "durationHours", header: "المدة (س)" },
    { key: "visitsCount", header: "زيارات" },
    { key: "momsCount", header: "أمهات" },
    { key: "productsCount", header: "منتجات" },
    { key: "onTime", header: "الالتزام" },
    { key: "locationText", header: "الموقع" },
    { key: "fenceLabel", header: "حالة الموقع" },
    { key: "autoClosed", header: "إغلاق تلقائي" },
    { key: "closeReason", header: "سبب الإغلاق" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatChip label="في الدوام الآن" value={onShiftCount} loading={repBusy} />
        <StatChip label="نسبة الحضور" value={repBusy ? undefined : `${avgAttendance}%`} loading={repBusy} />
        <StatChip label="الالتزام بالوقت" value={repBusy ? undefined : `${onTimeRate}%`} loading={repBusy} />
        <StatChip label="متوسط وقت البدء" value={repBusy ? undefined : avgStart} loading={repBusy} />
        <StatChip label="إجمالي الساعات" value={totalHours} loading={repBusy} />
        <StatChip label="إغلاق تلقائي" value={autoClosed} loading={repBusy} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatChip label="أيام إجازة معتمدة" value={lv?.totalLeaveDays} loading={leaveBusy} />
        <StatChip label="منها غير مدفوعة" value={lv?.unpaidLeaveDays} loading={leaveBusy} />
        <StatChip label="استئذان تأخير" value={lv?.delayPermitDays} loading={leaveBusy} />
        <StatChip label="انصراف مبكر" value={lv?.earlyLeaveDays} loading={leaveBusy} />
        <StatChip label="طلبات قيد المراجعة" value={lv?.pendingRequests} loading={leaveBusy} />
        <StatChip
          label="متوسط زمن القرار"
          value={leaveBusy ? undefined : lv?.avgDecisionHours != null ? `${lv.avgDecisionHours} س` : "—"}
          loading={leaveBusy}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="نسبة الحضور حسب الموظف">
          <ChartSlot busy={repBusy} error={repErr}>
            <MetricBarChart data={rep} nameKey="name" valueKey="attendanceRate" seriesName="% حضور" color={CHART_COLORS.green} topN={10} />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="نسبة التأخير حسب الموظف">
          <ChartSlot busy={repBusy} error={repErr}>
            <MetricBarChart data={rep} nameKey="name" valueKey="lateRate" seriesName="% تأخير" color={CHART_COLORS.red} topN={10} />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="إنجاز الساعات المتوقعة (%)">
          <ChartSlot busy={repBusy} error={repErr}>
            <MetricBarChart data={rep} nameKey="name" valueKey="hoursMetRate" seriesName="% ساعات" color={CHART_COLORS.primary} topN={10} />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="متوسط الأمهات لكل وردية">
          <ChartSlot busy={repBusy} error={repErr}>
            <MetricBarChart data={rep} nameKey="name" valueKey="avgMomsPerShift" seriesName="أمهات/وردية" color={CHART_COLORS.purple} topN={10} />
          </ChartSlot>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="الإجازات المعتمدة حسب النوع (مدفوعة/غير مدفوعة)">
          <ChartSlot busy={leaveBusy} error={leaveErr}>
            <StackedBarChart
              data={leave?.byType || []}
              nameKey="name"
              series={[
                { key: "paidDays", label: "مدفوعة", color: CHART_COLORS.green },
                { key: "unpaidDays", label: "غير مدفوعة", color: CHART_COLORS.red },
              ]}
            />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="حالات طلبات الاستئذان">
          <ChartSlot busy={leaveBusy} error={leaveErr}>
            <MetricBarChart
              data={leave?.byStatus || []}
              nameKey="name"
              valueKey="requests"
              seriesName="عدد الطلبات"
              color={CHART_COLORS.purple}
              sort={false}
            />
          </ChartSlot>
        </ChartCard>
      </div>

      <ChartCard title="الحضور عبر الزمن">
        <ChartSlot busy={!ts && !tsErr} error={tsErr}>
          <SynchronizedAreaChart
            data={ts?.data || []}
            granularity={granularity}
            onGranularityChange={setGranularity}
            series={[
              { key: "presentEmployees", label: "الحاضرون", color: CHART_COLORS.primary },
              { key: "onLeaveEmployees", label: "في إجازة معتمدة", color: CHART_COLORS.orange },
              { key: "lateCount", label: "ورديات متأخرة", color: CHART_COLORS.red },
              { key: "totalHours", label: "إجمالي الساعات", color: CHART_COLORS.green },
            ]}
          />
        </ChartSlot>
      </ChartCard>

      <ChartCard title="مواقع تسجيل الدخول (أخضر: في الوقت، أحمر: متأخر)">
        <ChartSlot busy={!detail && !detErr} error={detErr}>
          <ShiftLocationMap data={mapPoints} />
        </ChartSlot>
      </ChartCard>

      <ChartCard title="⚠ دوام لم يُغلق">
        <ChartSlot busy={!open && !openErr} error={openErr}>
          <AttentionPanel openShifts={open?.data || []} products={[]} />
        </ChartSlot>
      </ChartCard>

      <ChartCard title="سجل الورديات">
        <ChartSlot busy={!detail && !detErr} error={detErr}>
          <FilterableTable
            data={tableRows}
            columns={shiftCols}
            exportColumns={shiftExportCols}
            filename="shifts-detail.csv"
            searchKeys={["employee"]}
            searchPlaceholder="ابحث باسم الموظف..."
            filters={[
              { key: "onTime", label: "الالتزام", options: [{ label: "في الوقت", value: "في الوقت" }, { label: "متأخر", value: "متأخر" }] },
              { key: "autoClosed", label: "إغلاق تلقائي", options: [{ label: "نعم", value: "نعم" }, { label: "لا", value: "لا" }] },
            ]}
          />
        </ChartSlot>
      </ChartCard>
    </div>
  );
}

function GeofenceTab({ userToken, range }: TabProps) {
  const query = range ? qs(range) : null;
  const { data, error } = useJson<any>(query ? `/api/analytics/geofence-compliance?${query}` : null, userToken);
  const busy = !data && !error;
  const shifts = data?.summary?.shifts;
  const visits = data?.summary?.visits;
  const combinedPct = data?.summary?.combinedInRangePct;
  const outliers: any[] = data?.outliers || [];
  const needing: any[] = data?.hospitalsNeedingLocation || [];

  const statusBars = (c: any) => [
    { label: "داخل النطاق", count: c?.IN_RANGE ?? 0 },
    { label: "خارج النطاق", count: c?.OUT_OF_RANGE ?? 0 },
    { label: "بدون موقع", count: c?.NO_LOCATION_FIX ?? 0 },
    { label: "موقع المستشفى غير محدد", count: c?.HOSPITAL_NOT_CONFIGURED ?? 0 },
  ];

  const rows = outliers.map((o, i) => ({
    id: i,
    type: o.type === "visit" ? "زيارة" : "دوام",
    employee: o.employee || "غير محدد",
    hospital: o.hospital,
    distance: o.distanceMeters != null ? `${o.distanceMeters} م` : "—",
    time: fmtDT(o.time),
    startLoc: Number.isFinite(o.lat) && Number.isFinite(o.lng) ? { lat: o.lat, lng: o.lng } : null,
    hospitalLoc: Number.isFinite(o.hospitalLat) && Number.isFinite(o.hospitalLng) ? { lat: o.hospitalLat, lng: o.hospitalLng } : null,
    distanceText: o.distanceMeters != null ? `${o.distanceMeters}` : "",
  }));

  const cols: ColumnDef<any, any>[] = [
    { accessorKey: "type", header: "النوع" },
    { accessorKey: "employee", header: "الموظف" },
    { accessorKey: "hospital", header: "المستشفى" },
    { accessorKey: "distance", header: "المسافة" },
    { accessorKey: "time", header: "التوقيت" },
    {
      id: "location",
      header: "الموقع",
      enableSorting: false,
      cell: ({ row }) => (
        <LocationModal
          start={row.original.startLoc}
          hospital={row.original.hospitalLoc}
          startLabel="مكان التسجيل"
          hospitalLabel="موقع المستشفى"
          title="موقع التسجيل مقابل المستشفى"
          triggerText="عرض على الخريطة"
        />
      ),
    },
  ];
  const exportCols: CsvColumn<any>[] = [
    { key: "type", header: "النوع" },
    { key: "employee", header: "الموظف" },
    { key: "hospital", header: "المستشفى" },
    { key: "distanceText", header: "المسافة (م)" },
    { key: "time", header: "التوقيت" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="نسبة الالتزام بالموقع" value={busy ? undefined : `${combinedPct ?? 0}%`} loading={busy} />
        <StatChip label="تسجيلات خارج النطاق" value={(shifts?.OUT_OF_RANGE ?? 0) + (visits?.OUT_OF_RANGE ?? 0)} loading={busy} />
        <StatChip label="بدون تحديد موقع" value={(shifts?.NO_LOCATION_FIX ?? 0) + (visits?.NO_LOCATION_FIX ?? 0)} loading={busy} />
        <StatChip label="مستشفيات بدون موقع" value={needing.length} loading={busy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="التزام بدء الدوام بالموقع">
          <ChartSlot busy={busy} error={error}>
            <MetricBarChart data={statusBars(shifts)} nameKey="label" valueKey="count" seriesName="ورديات" layout="horizontal" sort={false} color={CHART_COLORS.primary} percentOfTotal />
          </ChartSlot>
        </ChartCard>
        <ChartCard title="التزام بدء الزيارات بالموقع">
          <ChartSlot busy={busy} error={error}>
            <MetricBarChart data={statusBars(visits)} nameKey="label" valueKey="count" seriesName="زيارات" layout="horizontal" sort={false} color={CHART_COLORS.teal} percentOfTotal />
          </ChartSlot>
        </ChartCard>
      </div>

      {needing.length > 0 && (
        <ChartCard title="مستشفيات بحاجة لتحديد الموقع (مهام إعداد)">
          <div className="flex flex-wrap gap-2">
            {needing.map((h) => (
              <a key={h._id} href={`/hospitals/${h._id}`} className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-sm hover:underline">
                {h.name}{h.city ? ` — ${h.city}` : ""}
              </a>
            ))}
          </div>
        </ChartCard>
      )}

      <ChartCard title="تسجيلات خارج النطاق">
        <ChartSlot busy={busy} error={error}>
          <>
            <FilterableTable
              data={rows}
              columns={cols}
              exportColumns={exportCols}
              filename="geofence-outliers.csv"
              searchKeys={["employee", "hospital"]}
              searchPlaceholder="ابحث بالموظف أو المستشفى..."
              filters={[{ key: "type", label: "النوع", options: [{ label: "دوام", value: "دوام" }, { label: "زيارة", value: "زيارة" }] }]}
            />
            {data?.outliersTruncated && (
              <p className="mt-2 text-xs text-amber-600">القائمة مقتطعة — يتم عرض أحدث التسجيلات فقط. ضيّق النطاق الزمني لعرض الكل.</p>
            )}
          </>
        </ChartSlot>
      </ChartCard>
    </div>
  );
}

const TABS: { key: string; label: string; Comp: (props: TabProps) => ReactNode }[] = [
  { key: "moms", label: "الأمهات", Comp: MomsTab },
  { key: "hospitals", label: "المستشفيات", Comp: HospitalsTab },
  { key: "employees", label: "الموظفون", Comp: EmployeesTab },
  { key: "products", label: "المنتجات", Comp: ProductsTab },
  { key: "attendance", label: "الحضور والالتزام", Comp: AttendanceTab },
  { key: "shifts", label: "الورديات", Comp: ShiftsTab },
  { key: "geofence", label: "الالتزام بالموقع", Comp: GeofenceTab },
  { key: "demographics", label: "الجنسيات", Comp: DemographicsTab },
  { key: "geography", label: "الجغرافيا", Comp: GeographyTab },
  { key: "funnel", label: "المسار والجودة", Comp: FunnelQualityTab },
];

export default function AnalyticsClient({ userToken }: { userToken?: string }) {
  const [range, setRange] = useState<ResolvedRange | null>(null);
  const [tab, setTab] = useState(TABS[0].key);

  return (
    <div>
      <div className="flex md:items-center flex-col md:flex-row justify-between mb-6 gap-4">
        <h1 className="font-bold text-3xl">التحليلات</h1>
        <DateRangeFilter defaultPreset="6months" onChange={setRange} />
      </div>

      <Tabs dir="rtl" value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => {
          const Comp = t.Comp;
          return (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <Comp userToken={userToken} range={range} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
