"use client"
import { BarChart3, BookUser, CalendarDays, Clock, Contact, Home, Hospital, LineChart, LogOut, Settings, Users, Warehouse } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useEffect, useState } from "react";
import { userRoles } from "@/models/enum.constants";
import { usePathname, useRouter } from "next/navigation";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Employees",
    url: "/employees",
    icon: Users,
  },
  {
    title: "Products",
    url: "/products",
    icon: Warehouse,
  },
  {
    title: "Visits",
    url: "/visits",
    icon: BookUser,
  },
  {
    title: "Hospitals",
    url: "/hospitals",
    icon: Hospital,
  },
  {
    title: "Moms",
    url: "/moms",
    icon: Contact,
  },
  {
    title: "Shifts",
    url: "/shifts",
    icon: Clock,
  },
  // Visible to every role: anyone can request leave, admins also review it.
  {
    title: "Leaves",
    url: "/leaves",
    icon: CalendarDays,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: LineChart,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]
export function AppSidebar({ userRole }: { userRole?: string }) {
  const router = useRouter();  
  const pathname = usePathname();
  const [dir, setDir] = useState<'ltr' | 'rtl'>('rtl');

  useEffect(() => {
    if(typeof window !== "undefined") {
      const direction = document.documentElement.getAttribute('dir') as 'ltr' | 'rtl';
      setDir(direction);
    };
  }, []);


  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" side={dir ==='ltr' ? "left" : "right"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="w-full flex items-center justify-center">Mabrook System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarSeparator />
            <SidebarMenu>
              {items.map((item) => {
                if (item.title === "Employees" && userRole !== userRoles.ADMIN) return null;
                if (item.title === "Reports" && userRole !== userRoles.ADMIN) return null;
                if (item.title === "Analytics" && userRole !== userRoles.ADMIN) return null;
                if (item.title === "Settings" && userRole !== userRoles.ADMIN) return null;
                if (item.title === "Products" && userRole === userRoles.EMPLOYEE) return null;
                return(
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`w-full flex items-center justify-center 
                      ${pathname.includes(item.url) ? 
                        item.url !== "/" ? 
                        'bg-gray-200 dark:bg-gray-700 font-bold underline' : 
                        '' : 
                        ''
                      }`} >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )})}
              
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="w-full flex items-center justify-center" >
                    <button onClick={handleLogout} className="cursor-pointer">
                      <LogOut />
                      <span>Logout</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
