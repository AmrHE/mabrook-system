import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { cookies } from "next/headers";

export default async function Layout({ children }: { children: React.ReactNode }) {
  
    const cookieStore = await cookies();
    const uerRole = cookieStore.get('role')?.value;
  return (
    <SidebarProvider>
      <AppSidebar userRole={uerRole}/>
      <main className="w-full">
        <SidebarTrigger />
        {/* TOP BAR COMPONENTS */}
        <div className="m-5">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}