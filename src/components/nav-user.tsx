import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronsUpDown, LogIn, LogOut, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { initials } from "@/components/access/access-ui";
import { findRole, fullName, logout, sessionEmployee } from "@/lib/access";
import { call, useAccess } from "@/lib/access-store";
import { DEMO_USER } from "@/lib/organization";

function UserLabel({ name, detail }: { name: string; detail: string }) {
  return <>
    <Avatar className="h-8 w-8 rounded-lg"><AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-semibold">{initials(name)}</AvatarFallback></Avatar>
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-semibold">{name}</span>
      <span className="truncate text-xs opacity-70">{detail}</span>
    </div>
  </>;
}

/** The signed-in employee and the way out; without a session, the requests pages' demo person and the way in. */
export function NavUser() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const state = useAccess();
  const employee = sessionEmployee(state);
  const name = employee ? fullName(employee) : DEMO_USER.name;
  const email = employee ? employee.email : DEMO_USER.email;
  const roles = employee ? employee.roleIds.map(id => findRole(state, id)?.name).filter(Boolean).join(", ") : "Sin sesión iniciada";
  const signOut = async () => {
    await call(logout);
    await navigate({ to: "/login" });
  };
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <UserLabel name={name} detail={email} />
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal"><div className="flex items-center gap-2 px-1 py-1.5"><UserLabel name={name} detail={roles} /></div></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {employee
                ? <DropdownMenuItem asChild><Link to="/empleados/$id" params={{ id: employee.id }}><UserRound />Mi cuenta</Link></DropdownMenuItem>
                : <DropdownMenuItem><UserRound />Mi cuenta</DropdownMenuItem>}
              <DropdownMenuItem><Bell />Notificaciones</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {employee
              ? <DropdownMenuItem onSelect={() => void signOut()}><LogOut />Cerrar sesión</DropdownMenuItem>
              : <DropdownMenuItem asChild><Link to="/login"><LogIn />Iniciar sesión</Link></DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
