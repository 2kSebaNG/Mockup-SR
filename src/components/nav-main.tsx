import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";

type NavLink = { title: string; to: "/" | "/mis-solicitudes" | "/gestionar-solicitudes" | "/revision-departamento" | "/catalogo" | "/empleados" | "/roles" | "/permisos" };
/** A sub-section inside a module (e.g. Recursos Humanos → Personas y accesos), opened like the module itself. */
type NavSection = { title: string; items: NavLink[] };
type NavEntry = NavLink | NavSection;
export type NavItem = { title: string; icon: LucideIcon } & ({ to: NavLink["to"]; items?: never } | { to?: never; items: NavEntry[] });

// A section stays highlighted on its inner pages (/empleados/…, /roles/…).
const within = (pathname: string, to: string) => pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
const isSection = (entry: NavEntry): entry is NavSection => "items" in entry;
const links = (entries: NavEntry[]): NavLink[] => entries.flatMap(entry => (isSection(entry) ? entry.items : [entry]));

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => item.items ? (
          <Collapsible key={item.title} asChild defaultOpen className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title} isActive={links(item.items).some(sub => within(pathname, sub.to))}>
                  <item.icon />
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map(entry => isSection(entry) ? (
                    <Collapsible key={entry.title} asChild defaultOpen className="group/section">
                      <SidebarMenuSubItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuSubButton asChild isActive={false}>
                            <button type="button" className="nav-section-trigger">
                              <span>{entry.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/section:rotate-90" />
                            </button>
                          </SidebarMenuSubButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="nav-section-items">
                            {entry.items.map(sub => (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton asChild isActive={within(pathname, sub.to)}>
                                  <Link to={sub.to}><span>{sub.title}</span></Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuSubItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuSubItem key={entry.title}>
                      <SidebarMenuSubButton asChild isActive={within(pathname, entry.to)}>
                        <Link to={entry.to}><span>{entry.title}</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ) : (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title} isActive={item.to === pathname}>
              <Link to={item.to}><item.icon /><span>{item.title}</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
