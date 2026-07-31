import { fenceStatus } from "@/models/enum.constants";
import { FENCE_STATUS_LABELS } from "@/utils/geo/geofence";

const CLASSNAMES: Record<fenceStatus, string> = {
  [fenceStatus.IN_RANGE]: "bg-green-100 text-green-700",
  [fenceStatus.OUT_OF_RANGE]: "bg-red-100 text-red-700",
  [fenceStatus.NO_LOCATION_FIX]: "bg-gray-100 text-gray-600",
  [fenceStatus.HOSPITAL_NOT_CONFIGURED]: "bg-amber-100 text-amber-700",
};

/**
 * Colored badge for a shift/visit check-in's geofence classification. Renders "—"
 * for legacy records that predate geofencing (no status). Pure presentational,
 * safe in server and client components.
 */
export default function FenceBadge({
  status,
  distanceMeters,
}: {
  status?: fenceStatus | string;
  distanceMeters?: number | null;
}) {
  if (!status || !(status in CLASSNAMES)) return <span className="text-gray-400">—</span>;
  const label = FENCE_STATUS_LABELS[status as fenceStatus];
  const className = CLASSNAMES[status as fenceStatus];
  const showDistance = status === fenceStatus.OUT_OF_RANGE && distanceMeters != null;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
      {showDistance ? ` · ${distanceMeters} م` : ""}
    </span>
  );
}
