import { Fragment } from "react";
import { Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export function SiteHeader({ trail }: { trail: string[] }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-trail">
          <SidebarTrigger className="header-sidebar-trigger" />
          <Separator orientation="vertical" className="header-divider" />
          <Breadcrumb>
            <BreadcrumbList className="header-breadcrumb">
              {trail.map((step, index) => index < trail.length - 1 ? (
                <Fragment key={step}>
                  <BreadcrumbItem className="header-crumb-parent">{step}</BreadcrumbItem>
                  <BreadcrumbSeparator className="header-crumb-parent" />
                </Fragment>
              ) : (
                <BreadcrumbItem key={step}><BreadcrumbPage className="header-crumb-current">{step}</BreadcrumbPage></BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Button variant="on-surface"><Grid2X2 />Módulos</Button>
        </div>
      </div>
    </header>
  );
}
