import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, House } from "lucide-react";

import { NavMain, type NavItem } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar";
import { DEMO_USER } from "@/lib/organization";

const navigation: NavItem[] = [
  { title: "Inicio", to: "/", icon: House },
  {
    title: "Solicitudes",
    icon: ClipboardList,
    items: [
      { title: "Mis solicitudes", to: "/mis-solicitudes" },
      { title: "Revisar solicitudes", to: "/gestionar-solicitudes" },
      { title: "Gestión de departamento", to: "/revision-departamento" },
      { title: "Catálogo", to: "/catalogo" },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Ecosistema X">
              <Link to="/">
                <span className="sidebar-brand-mark">X</span>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="sidebar-brand-name">ECOSISTEMA X</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">Gestión conectada</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navigation} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={DEMO_USER} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
