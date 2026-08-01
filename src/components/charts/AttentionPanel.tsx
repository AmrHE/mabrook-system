"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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
/** One hospital × box below the low-stock threshold (see /api/analytics/hospital-stock-alerts). */
type HospitalStockAlert = {
  hospitalId: string;
  hospitalName: string;
  productId: string;
  productName: string;
  quantity: number;
};

/** Rows rendered per section before collapsing the rest into a "+N others" line. */
const MAX_ROWS = 6;

export default function AttentionPanel({
  openShifts,
  products,
  lowMomRateVisits,
  hospitalStockAlerts,
  outOfStockThreshold = OUT_OF_STOCK_THRESHOLD,
  lowStockThreshold = LOW_STOCK_THRESHOLD,
}: {
  openShifts: OpenShift[];
  products: Product[];
  lowMomRateVisits?: LowMomRateVisit[];
  /** Per-hospital stock rows. Stock sections render only when this is supplied. */
  hospitalStockAlerts?: HospitalStockAlert[];
  outOfStockThreshold?: number;
  lowStockThreshold?: number;
}) {
  const list = products || [];
  // Stock is flagged per hospital, not on the box's global total: a box can be
  // plentiful company-wide and still be at zero in the hospital that needs it.
  const alerts = hospitalStockAlerts || [];
  const outOfStock = alerts.filter((a) => a.quantity < outOfStockThreshold);
  const lowStock = alerts.filter((a) => a.quantity >= outOfStockThreshold && a.quantity < lowStockThreshold);
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
        <StockSection
          icon={<PackageX className="size-4" />}
          color="text-red-600"
          title={`نفذ المخزون في مستشفيات (${outOfStock.length})`}
          alerts={outOfStock}
        />
      )}
      {lowStock.length > 0 && (
        <StockSection
          icon={<AlertTriangle className="size-4" />}
          color="text-amber-600"
          title={`مخزون منخفض في مستشفيات (${lowStock.length})`}
          alerts={lowStock}
        />
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

/** Stock rows link to the hospital page so the admin can restock or transfer in one click. */
function StockSection({
  icon,
  color,
  title,
  alerts,
}: {
  icon: ReactNode;
  color: string;
  title: string;
  alerts: HospitalStockAlert[];
}) {
  const shown = alerts.slice(0, MAX_ROWS);
  const rest = alerts.length - shown.length;

  return (
    <Section icon={icon} color={color} title={title}>
      {shown.map((a) => (
        <Row
          key={`${a.hospitalId}-${a.productId}`}
          href={`/hospitals/${a.hospitalId}`}
          label={a.hospitalName}
          sub={a.productName}
          value={fmtNumber(a.quantity)}
        />
      ))}
      {rest > 0 && <p className="text-xs text-muted-foreground px-3 pt-1">و {fmtNumber(rest)} أخرى…</p>}
    </Section>
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

function Row({ label, sub, value, href }: { label: string; sub?: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="min-w-0 truncate">
        {label}
        {sub && <span className="text-gray-500"> — {sub}</span>}
      </span>
      {value && <span className="text-gray-500 shrink-0">{value}</span>}
    </>
  );

  const className = "flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-md px-3 py-1.5";

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link href={href} className={`${className} hover:bg-gray-100 transition-colors`}>
      {body}
    </Link>
  );
}
