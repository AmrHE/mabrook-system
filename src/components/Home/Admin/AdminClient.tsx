/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Baby, BookHeart, Hospital, MapPinHouse, UserCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DateRangeFilter, { type ResolvedRange } from "@/components/DateRangeFilter";
import MomsTrendChart from "@/components/charts/MomsTrendChart";
import HospitalsBarChart from "@/components/charts/HospitalsBarChart";
import NationalityPieChart from "@/components/charts/NationalityPieChart";
import GenderDonut from "@/components/charts/GenderDonut";
import MultipleBirthsChart from "@/components/charts/MultipleBirthsChart";
import EmployeesBarChart from "@/components/charts/EmployeesBarChart";
import ProductsConsumptionChart from "@/components/charts/ProductsConsumptionChart";
import AttentionPanel from "@/components/charts/AttentionPanel";
import SynchronizedAreaChart from "@/components/charts/SynchronizedAreaChart";
import HeatmapMatrix from "@/components/charts/HeatmapMatrix";
import DataQualityPanel from "@/components/charts/DataQualityPanel";
import DeltaBadge from "@/components/charts/DeltaBadge";
import { CHART_COLORS, computeDelta, fmtNumber, pct, type Delta, type Granularity } from "@/components/charts/constants";

interface AnalyticsData {
  overview: any | null;
  timeseries: any[];
  hospitals: any[];
  employees: any[];
  demographics: any | null;
  products: any[];
  productThresholds: { outOfStock: number; lowStock: number } | null;
  openShifts: any[];
  lowMomRateVisits: any[];
  conversion: any[];
  heatmap: { data: any[]; max: number };
  dataQuality: any | null;
}

const EMPTY: AnalyticsData = {
  overview: null,
  timeseries: [],
  hospitals: [],
  employees: [],
  demographics: null,
  products: [],
  productThresholds: null,
  openShifts: [],
  lowMomRateVisits: [],
  conversion: [],
  heatmap: { data: [], max: 0 },
  dataQuality: null,
};

const AdminDashboardClient: React.FC<{ userToken?: string }> = ({ userToken }) => {
  const [range, setRange] = useState<ResolvedRange | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const granularityRef = useRef(granularity);
  granularityRef.current = granularity;

  const [convGranularity, setConvGranularity] = useState<Granularity>("week");
  const convGranularityRef = useRef(convGranularity);
  convGranularityRef.current = convGranularity;

  const authedGet = useCallback(
    async (path: string) => {
      const res = await fetch(path, { headers: { authorization: `Bearer ${userToken}` } });
      if (!res.ok) throw new Error(`فشل تحميل البيانات (${res.status})`);
      return res.json();
    },
    [userToken],
  );

  const loadAll = useCallback(
    async (r: ResolvedRange) => {
      setLoading(true);
      setError(null);
      const qs = `from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
      const g = granularityRef.current;
      const cg = convGranularityRef.current;

      // Resilient load: one failing endpoint must not blank the whole dashboard.
      let failed = 0;
      const wrap = <T,>(p: Promise<any>, fallback: T): Promise<T> =>
        p.catch(() => {
          failed++;
          return fallback;
        });

      const [overview, timeseries, hospitals, employees, demographics, products, openShifts, lowMomRateVisits, conversion, heatmap, dataQuality] =
        await Promise.all([
          wrap(authedGet(`/api/analytics/overview?${qs}`), null),
          wrap(authedGet(`/api/analytics/moms-timeseries?${qs}&granularity=${g}`), { data: [] }),
          wrap(authedGet(`/api/analytics/hospitals-ranking?${qs}`), { data: [] }),
          wrap(authedGet(`/api/analytics/employees-report?${qs}`), { data: [] }),
          wrap(authedGet(`/api/analytics/demographics?${qs}`), null),
          wrap(authedGet(`/api/analytics/products-consumption?${qs}`), { data: [] }),
          wrap(authedGet(`/api/analytics/open-shifts`), { data: [] }),
          wrap(authedGet(`/api/analytics/low-mom-rate-visits?${qs}`), { data: [] }),
          wrap(authedGet(`/api/analytics/conversion-timeseries?${qs}&granularity=${cg}`), { data: [] }),
          wrap(authedGet(`/api/analytics/activity-heatmap?${qs}`), { data: [], max: 0 }),
          wrap(authedGet(`/api/analytics/data-quality?${qs}`), null),
        ]);

      setData({
        overview,
        timeseries: timeseries?.data || [],
        hospitals: hospitals?.data || [],
        employees: employees?.data || [],
        demographics,
        products: products?.data || [],
        productThresholds: (products as any)?.thresholds || null,
        openShifts: openShifts?.data || [],
        lowMomRateVisits: lowMomRateVisits?.data || [],
        conversion: conversion?.data || [],
        heatmap: { data: heatmap?.data || [], max: heatmap?.max || 0 },
        dataQuality,
      });
      if (failed > 0) setError(`تعذّر تحميل ${failed} من المؤشرات`);
      setLoading(false);
    },
    [authedGet],
  );

  useEffect(() => {
    if (range) loadAll(range);
  }, [range, loadAll]);

  const handleGranularity = useCallback(
    async (g: Granularity) => {
      setGranularity(g);
      if (!range) return;
      try {
        const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
        const ts = await authedGet(`/api/analytics/moms-timeseries?${qs}&granularity=${g}`);
        setData((d) => ({ ...d, timeseries: ts.data || [] }));
      } catch {
        /* keep previous series on failure */
      }
    },
    [range, authedGet],
  );

  const handleConvGranularity = useCallback(
    async (g: Granularity) => {
      setConvGranularity(g);
      if (!range) return;
      try {
        const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
        const conv = await authedGet(`/api/analytics/conversion-timeseries?${qs}&granularity=${g}`);
        setData((d) => ({ ...d, conversion: conv.data || [] }));
      } catch {
        /* keep previous series on failure */
      }
    },
    [range, authedGet],
  );

  const cur = data.overview?.current;
  const prev = data.overview?.previous;
  const demo = data.demographics;

  return (
    <div>
      <div className="flex md:items-center flex-col md:flex-row justify-between mb-6 px-2 gap-4">
        <h1 className="font-bold text-2xl">الصفحة الرئيسية للأدمن</h1>
        <DateRangeFilter defaultPreset="6months" onChange={setRange} />
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {/* KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KpiCard loading={loading} icon={<Users className="size-5" />} label="الموظفون" value={cur?.employees} prev={prev?.employees} />
        <KpiCard loading={loading} icon={<UserCheck className="size-5" />} label="في الدوام" value={data.overview?.employeesOnShift} />
        <KpiCard loading={loading} icon={<Hospital className="size-5" />} label="مستشفيات نشطة" value={cur?.activeHospitals} prev={prev?.activeHospitals} />
        <KpiCard loading={loading} icon={<MapPinHouse className="size-5" />} label="الزيارات" value={cur?.visits} prev={prev?.visits} />
        <KpiCard loading={loading} icon={<BookHeart className="size-5" />} label="الأمهات" value={cur?.moms} prev={prev?.moms} />
        <KpiCard loading={loading} icon={<Baby className="size-5" />} label="المواليد" value={cur?.newborns} prev={prev?.newborns} />
      </div>

      {/* SECONDARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MiniStat loading={loading} label="الوصول التراكمي (الكل)" value={data.overview?.reachAllTime} />
        <MiniStat
          loading={loading}
          label="منتجات موزّعة"
          value={cur?.productsDistributed}
          delta={computeDelta(cur?.productsDistributed, prev?.productsDistributed)}
        />
        <MiniStat
          loading={loading}
          label="موافقات تواصل"
          value={cur?.consent}
          share={cur ? { pct: pct(cur.consent, cur.moms), of: "من الأمهات" } : null}
        />
        <MiniStat loading={loading} label="نسبة التوقيع" value={cur ? `${pct(cur.withSignature, cur.moms)}%` : undefined} />
        <MiniStat
          loading={loading}
          label="توائم فأكثر"
          value={cur?.twinsPlus}
          share={cur ? { pct: pct(cur.twinsPlus, cur.moms), of: "من الأمهات" } : null}
        />
      </div>

      {/* TREND (full width) */}
      <ChartCard title="اتجاه تسجيل الأمهات">
        {loading ? (
          <ChartSkeleton />
        ) : (
          <MomsTrendChart data={data.timeseries} granularity={granularity} onGranularityChange={handleGranularity} />
        )}
      </ChartCard>

      {/* 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <ChartCard title="أعلى / أدنى المستشفيات">
          {loading ? <ChartSkeleton /> : <HospitalsBarChart data={data.hospitals} />}
        </ChartCard>
        <ChartCard title="الجنسيات (سعودي / غير سعودي)">
          {loading ? <ChartSkeleton /> : <NationalityPieChart data={demo?.nationality} />}
        </ChartCard>

        <ChartCard title="أداء الموظفين">
          {loading ? <ChartSkeleton /> : <EmployeesBarChart data={data.employees} />}
        </ChartCard>
        <ChartCard title="التوائم والجنس">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-center text-sm text-muted-foreground mb-1">الجنس</p>
                <GenderDonut data={demo?.gender} />
              </div>
              <div>
                <p className="text-center text-sm text-muted-foreground mb-1">تعدد المواليد</p>
                <MultipleBirthsChart data={demo?.births} />
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="استهلاك المنتجات">
          {loading ? <ChartSkeleton /> : <ProductsConsumptionChart data={data.products} />}
        </ChartCard>
        <ChartCard title="⚠ يحتاج انتباه">
          {loading ? <ChartSkeleton /> : (
            <AttentionPanel
              openShifts={data.openShifts}
              products={data.products}
              lowMomRateVisits={data.lowMomRateVisits}
              outOfStockThreshold={data.productThresholds?.outOfStock}
              lowStockThreshold={data.productThresholds?.lowStock}
            />
          )}
        </ChartCard>

        <ChartCard title="تحوّل الحملة عبر الزمن">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <SynchronizedAreaChart
              data={data.conversion}
              granularity={convGranularity}
              onGranularityChange={handleConvGranularity}
              series={[
                { key: "moms", label: "الأمهات", color: CHART_COLORS.primary },
                { key: "consent", label: "وافقوا على التواصل", color: CHART_COLORS.green },
                { key: "signed", label: "موقّعة", color: CHART_COLORS.orange },
                { key: "surveyed", label: "أكملوا الاستبيان", color: CHART_COLORS.teal },
              ]}
            />
          )}
        </ChartCard>
        <ChartCard title="أوقات ذروة تسجيل الأمهات">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <HeatmapMatrix
              data={data.heatmap.data}
              max={data.heatmap.max}
              metricLabel="تسجيلات الأمهات"
              valueNoun="أم"
              from={range?.from}
              to={range?.to}
            />
          )}
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="جودة البيانات">
            {/* Pass `range` so the drill-down inherits the range shown here
                instead of silently falling back to the default 6-month window. */}
            {loading ? <ChartSkeleton /> : <DataQualityPanel stats={data.dataQuality} range={range} />}
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardClient;

/* ---------- helpers ---------- */

const KpiCard = ({
  loading,
  icon,
  label,
  value,
  prev,
}: {
  loading: boolean;
  icon: ReactNode;
  label: string;
  value?: number;
  prev?: number;
}) => {
  const delta = prev !== undefined ? computeDelta(value, prev) : null;
  return (
    <Card className="py-4 gap-2">
      <CardContent className="px-4">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-[#5570F1]/10 p-2 text-[#5570F1]">{icon}</div>
          <DeltaBadge delta={delta} />
        </div>
        <p className="text-sm text-gray-500 mt-3">{label}</p>
        {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="font-bold text-2xl">{fmtNumber(value)}</p>}
      </CardContent>
    </Card>
  );
};

const MiniStat = ({
  loading,
  label,
  value,
  share,
  delta,
}: {
  loading: boolean;
  label: string;
  value?: number | string;
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

const ChartCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card>
    <CardHeader className="pb-0">
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const ChartSkeleton = () => <Skeleton className="w-full h-[300px]" />;
