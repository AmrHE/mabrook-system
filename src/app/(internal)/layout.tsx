import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import SessionKeeper from "@/components/SessionKeeper"
import { requireServerSession } from "@/utils/auth/serverSession.server";
import { getGeofenceRadiusMeters } from "@/utils/settings/geofenceRadius.server";
import { GeofenceRadiusProvider } from "@/components/GeofenceRadiusProvider";

export default async function Layout({ children }: { children: React.ReactNode }) {

    const { payload } = await requireServerSession();
    // Read once for the whole internal app: every map draws the same zone, and
    // the settings endpoint that serves it is admin-only.
    const geofenceRadiusMeters = await getGeofenceRadiusMeters();
  return (
    <SidebarProvider>
      {/* Mounted here rather than per page: layouts survive soft navigation, so
          the session refresher runs once per hard load instead of on every route. */}
      <SessionKeeper />
      <AppSidebar userRole={payload.role}/>
      <main className="w-full">
        <SidebarTrigger />
        {/* TOP BAR COMPONENTS */}
        <div className="m-5">
          <GeofenceRadiusProvider value={geofenceRadiusMeters}>{children}</GeofenceRadiusProvider>
        </div>
      </main>
    </SidebarProvider>
  )
}
