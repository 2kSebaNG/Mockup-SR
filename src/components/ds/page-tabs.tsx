import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * Tabs between the pages of one record (a project's Reporte, Presupuesto and Plan): each tab is a link, so the URL
 * says which one is open. They scroll sideways inside their own row when they do not fit.
 */
export function PageTabs({ label, className, ...props }: ComponentProps<"nav"> & { label: string }) {
  return <nav aria-label={label} className={cn("ds-page-tabs", className)} {...props} />;
}

/** One tab: pass the router `Link` as its child (`asChild`). */
export function PageTab({ active = false, asChild = false, className, ...props }: ComponentProps<"a"> & { active?: boolean; asChild?: boolean }) {
  const Component = asChild ? Slot : "a";
  return <Component aria-current={active ? "page" : undefined} className={cn("ds-page-tab", className)} {...props} />;
}
