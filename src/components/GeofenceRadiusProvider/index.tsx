"use client";

import { createContext, useContext } from "react";

/**
 * The geofence radius, shared with every map in the internal app.
 *
 * Context rather than props: it is one org-wide number consumed by a leaf
 * (`LocationModal`, `HospitalLocationPicker`) from a dozen places, several of
 * them behind module-level column definitions that can't close over a prop.
 * `GET /api/settings` is admin-guarded, so the value is read server-side in the
 * internal layout and handed down here instead of fetched.
 */
const GeofenceRadiusContext = createContext<number | undefined>(undefined);

export function GeofenceRadiusProvider({
  value,
  children,
}: {
  value?: number;
  children: React.ReactNode;
}) {
  return <GeofenceRadiusContext.Provider value={value}>{children}</GeofenceRadiusContext.Provider>;
}

/** Undefined outside the provider (or before settings load) — callers draw no circle. */
export function useGeofenceRadius(): number | undefined {
  return useContext(GeofenceRadiusContext);
}
