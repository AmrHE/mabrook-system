import { initDb } from "@/lib/mongoose";
import { getSettings } from "@/utils/settings/getSettings";

/**
 * The geofence radius, for Server Components that render a map.
 *
 * `GET /api/settings` is admin-guarded, but the zone circle belongs on
 * employee-facing pages too — so the pages that host a `LocationModal` read the
 * value here and pass it down as a prop rather than fetching it over HTTP.
 */
export async function getGeofenceRadiusMeters(): Promise<number> {
  await initDb();
  const settings = await getSettings();
  return settings.geofenceRadiusMeters;
}
