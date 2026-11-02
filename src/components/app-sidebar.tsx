import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, House, Package, Palette, UsersRound } from "lucide-react";

import { NavMain, navLinks as links, type NavEntry, type NavItem } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar";
import { can, sessionEmployee, type PermissionCode } from "@/lib/access";
import { useAccess } from "@/lib/access-store";
import { procurementSections, reportView } from "@/lib/abastecimiento/navigation";

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
  const modules: NavItem[] = people.length ? [...navigation, { title: "Recursos Humanos", icon: UsersRound, items: [{ title: "Personas y accesos", items: people }] }] : [...navigation];
  // Abastecimiento: Reporte, then its sections (Compras, Negocios, Administración); empty sections are left out.
  const open = (permission: PermissionCode) => !signedIn || can(access, permission);
  const procurement: NavEntry[] = [
    ...(open(reportView.permission) ? [{ title: reportView.title, to: reportView.to }] : []),
    ...procurementSections
      .map(section => ({ title: section.title, items: section.views.filter(view => open(view.permission)).map(({ title, to }) => ({ title, to })) }))
      .filter(section => section.items.length > 0),
  ];
  // "Usuarios y roles" only leads to Personas y accesos: it does not make the module worth showing on its own.
  const ownViews = links(procurement).filter(link => link.to !== "/abastecimiento/admin/usuarios");
  if (ownViews.length) modules.push({ title: "Abastecimiento", icon: Package, items: procurement });
  // The design system's live reference, last: it is for whoever builds the views.
  const items: NavItem[] = [...modules, { title: "Sistema de diseño", to: "/sistema-diseno", icon: Palette }];
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
