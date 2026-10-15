import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { QuickAccess } from "@/components/quick-access";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/** Shared page frame: navigation sidebar, header with breadcrumb, and the floating quick-access menu. */
export function AppShell({ trail, children }: { trail: string[]; children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader trail={trail} />
        {children}
        <QuickAccess />
      </SidebarInset>
    </SidebarProvider>
  );
}
