"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Clock, HelpCircle, PackageX, TrendingDown } from "lucide-react";
import { fmtNumber } from "./constants";
import { OUT_OF_STOCK_THRESHOLD, LOW_STOCK_THRESHOLD } from "@/utils/stock/thresholds";

type OpenShift = { shiftId: string; employeeName: string; elapsedHours: number };
type Product = { productId: string; name: string; totalQuantity: number; questionsCount: number };
type LowMomRateVisit = {
  visitId: string;
  employeeName: string;
  hospitalName: string;
  momsCount: number;
  durationHours: number;
};

export default function AttentionPanel({
  openShifts,
  products,
  lowMomRateVisits,
  outOfStockThreshold = OUT_OF_STOCK_THRESHOLD,
  lowStockThreshold = LOW_STOCK_THRESHOLD,
}: {
  openShifts: OpenShift[];
  products: Product[];
  lowMomRateVisits?: LowMomRateVisit[];
  outOfStockThreshold?: number;
  lowStockThreshold?: number;
}) {
  const list = products || [];
  const outOfStock = list.filter((p) => p.totalQuantity < outOfStockThreshold);
  const lowStock = list.filter(
    (p) => p.totalQuantity >= outOfStockThreshold && p.totalQuantity < lowStockThreshold,
  );
  const noQuestions = list.filter((p) => (p.questionsCount || 0) === 0);
  const shifts = openShifts || [];
  // Already filtered and sorted worst-first by /api/analytics/low-mom-rate-visits.
  const slowVisits = lowMomRateVisits || [];

  const empty =
    shifts.length === 0 &&
    outOfStock.length === 0 &&
    lowStock.length === 0 &&
    noQuestions.length === 0 &&
    slowVisits.length === 0;

  if (empty) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        كل شيء على ما يرام 🎉
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[320px] overflow-y-auto pe-1">
      {shifts.length > 0 && (
        <Section icon={<Clock className="size-4" />} color="text-orange-600" title={`دوام لم يُغلق (${shifts.length})`}>
          {shifts.slice(0, 5).map((s) => (
            <Row key={s.shiftId} label={s.employeeName} value={`${fmtNumber(s.elapsedHours)} ساعة`} />
          ))}
        </Section>
      )}
      {slowVisits.length > 0 && (
        <Section
          icon={<TrendingDown className="size-4" />}
          color="text-orange-600"
          title={`زيارات بإنتاجية منخفضة (${slowVisits.length})`}
        >
          {slowVisits.slice(0, 5).map((v) => (
            <Row
              key={v.visitId}
              label={`${v.employeeName} — ${v.hospitalName}`}
              value={`${fmtNumber(v.momsCount)} أم / ${v.durationHours} س`}
            />
          ))}
        </Section>
      )}
      {outOfStock.length > 0 && (
        <Section icon={<PackageX className="size-4" />} color="text-red-600" title={`منتجات نفذت (${outOfStock.length})`}>
          {outOfStock.slice(0, 5).map((p) => (
            <Row key={p.productId} label={p.name} value={fmtNumber(p.totalQuantity)} />
          ))}
        </Section>
      )}
      {lowStock.length > 0 && (
        <Section icon={<AlertTriangle className="size-4" />} color="text-amber-600" title={`مخزون منخفض (${lowStock.length})`}>
          {lowStock.slice(0, 5).map((p) => (
            <Row key={p.productId} label={p.name} value={fmtNumber(p.totalQuantity)} />
          ))}
        </Section>
      )}
      {noQuestions.length > 0 && (
        <Section icon={<HelpCircle className="size-4" />} color="text-blue-600" title={`منتجات بدون أسئلة (${noQuestions.length})`}>
          {noQuestions.slice(0, 5).map((p) => (
            <Row key={p.productId} label={p.name} value="" />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  color,
  title,
  children,
}: {
  icon: ReactNode;
  color: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 font-medium mb-2 ${color}`}>
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-md px-3 py-1.5">
      <span className="truncate">{label}</span>
      {value && <span className="text-gray-500 shrink-0">{value}</span>}
    </div>
  );
}
