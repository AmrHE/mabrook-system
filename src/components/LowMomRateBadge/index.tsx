/**
 * Colored badge for a visit's productivity verdict (أمهات/ساعة vs the team
 * average). Renders "—" for visits that aren't judged: still in progress,
 * shorter than the configured minimum, or recorded before there was enough
 * history to compute a baseline. Pure presentational, safe in server and client
 * components — mirrors FenceBadge.
 *
 * Unlike LocationModal this is non-interactive, so it needs no stopPropagation
 * when used as a cell inside a click-navigable row.
 */
export default function LowMomRateBadge({
  low,
  momsPerHour,
  baselineDays,
}: {
  low?: boolean | null;
  momsPerHour?: number | null;
  baselineDays?: number;
}) {
  if (low == null || momsPerHour == null) return <span className="text-gray-400">—</span>;

  const title = baselineDays ? `مقارنةً بمتوسط الفريق في آخر ${baselineDays} يوم` : undefined;

  if (!low) {
    return (
      <span
        title={title}
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700"
      >
        طبيعية · {momsPerHour} أم/س
      </span>
    );
  }

  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700"
    >
      إنتاجية منخفضة · {momsPerHour} أم/س
    </span>
  );
}
