import { fenceStatus } from "@/models/enum.constants";

export interface LatLng {
  lat?: number | null;
  lng?: number | null;
}

/** True only when both coordinates are finite numbers. */
function isValidPoint(p: LatLng | null | undefined): p is { lat: number; lng: number } {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle (Haversine) distance in meters between two coordinates.
 * Returns null when either point is missing/invalid.
 */
export function distanceMeters(a: LatLng | null | undefined, b: LatLng | null | undefined): number | null {
  if (!isValidPoint(a) || !isValidPoint(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface FenceResult {
  status: fenceStatus;
  /** Distance from the hospital in meters (rounded); null when not evaluable. */
  distanceMeters: number | null;
}

/** Arabic labels for each fence status — single source for badges, CSV, and reports. */
export const FENCE_STATUS_LABELS: Record<fenceStatus, string> = {
  [fenceStatus.IN_RANGE]: "داخل النطاق",
  [fenceStatus.OUT_OF_RANGE]: "خارج النطاق",
  [fenceStatus.NO_LOCATION_FIX]: "بدون موقع",
  [fenceStatus.HOSPITAL_NOT_CONFIGURED]: "موقع المستشفى غير محدد",
};

export function fenceStatusLabel(status?: fenceStatus | string): string {
  return status && status in FENCE_STATUS_LABELS ? FENCE_STATUS_LABELS[status as fenceStatus] : "—";
}

/**
 * Classify a check-in location against a hospital's coordinates. Single source of
 * truth shared by shift create, visit create, and the compliance report so every
 * caller labels a check-in identically. Never throws; soft mode never blocks.
 *
 *  - no device fix        -> NO_LOCATION_FIX
 *  - hospital has no coords -> HOSPITAL_NOT_CONFIGURED
 *  - within radius        -> IN_RANGE
 *  - otherwise            -> OUT_OF_RANGE
 */
export function evaluateFence(
  loc: LatLng | null | undefined,
  hospitalLoc: LatLng | null | undefined,
  radiusMeters: number,
): FenceResult {
  if (!isValidPoint(loc)) return { status: fenceStatus.NO_LOCATION_FIX, distanceMeters: null };
  if (!isValidPoint(hospitalLoc)) return { status: fenceStatus.HOSPITAL_NOT_CONFIGURED, distanceMeters: null };

  const dist = distanceMeters(loc, hospitalLoc)!;
  const rounded = Math.round(dist);
  return {
    status: dist <= radiusMeters ? fenceStatus.IN_RANGE : fenceStatus.OUT_OF_RANGE,
    distanceMeters: rounded,
  };
}
