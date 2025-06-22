"use client"
import { BookUser, Contact, Home, Hospital, Settings } from "lucide-react"

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

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
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
    title: "Settings",
    url: "#",
    icon: Settings,
  },
]

export function AppSidebar() {
  const [dir, setDir] = useState<'ltr' | 'rtl'>('rtl');

  useEffect(() => {
    if(typeof window !== "undefined") {
      const direction = document.documentElement.getAttribute('dir') as 'ltr' | 'rtl';
      // console.log(direction)
      setDir(direction);
    };
  }, []);

  return (
    <Sidebar collapsible="icon" variant="sidebar" side={dir ==='ltr' ? "left" : "right"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="w-full flex items-center justify-center">Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarSeparator />
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="w-full flex items-center justify-center">
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarSeparator />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
