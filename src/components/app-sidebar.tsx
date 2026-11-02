import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, House, UsersRound } from "lucide-react";

import { NavMain, type NavItem } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar";
import { can, sessionEmployee, type PermissionCode } from "@/lib/access";
import { useAccess } from "@/lib/access-store";

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

const accessLinks: { title: string; to: "/empleados" | "/roles" | "/permisos"; permission: PermissionCode }[] = [
  { title: "Empleados", to: "/empleados", permission: "employees.read" },
  { title: "Roles", to: "/roles", permission: "roles.read" },
  { title: "Permisos", to: "/permisos", permission: "roles.read" },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const access = useAccess();
  // Signed in, the menu shows what the session's permissions open; signed out, every link leads to the login first.
  const signedIn = sessionEmployee(access) !== null;
  const people = accessLinks.filter(link => !signedIn || can(access, link.permission)).map(({ title, to }) => ({ title, to }));
  // Personas y accesos is a section of the Recursos Humanos module.
  const items: NavItem[] = people.length ? [...navigation, { title: "Recursos Humanos", icon: UsersRound, items: [{ title: "Personas y accesos", items: people }] }] : navigation;
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
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
