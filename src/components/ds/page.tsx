import type { ComponentProps, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The content column of a page inside `AppShell`: centered, at most --page-max wide (wider on big screens), with
 * the page padding. `narrow` is for forms and single-record pages.
 */
export function Page({ narrow = false, className, ...props }: ComponentProps<"div"> & { narrow?: boolean }) {
  return <div className={cn("ds-page", narrow && "ds-page--narrow", className)} {...props} />;
}

/**
 * Eyebrow (the section, in red caps), the title in the display font, a one-sentence description and the page's
 * actions on the right; the actions drop below the text when there is no room, two per row on phones.
 */
export function PageHeader({ eyebrow, title, description, actions, back }: {
  eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode;
}) {
  return (
    <>
      {back}
      {/* Above the header row, so the actions line up with the title. */}
      {eyebrow && <p className="ds-eyebrow">{eyebrow}</p>}
      <header className="ds-page-header">
        <div className="ds-page-header-text">
          <h1 className="ds-title">{title}</h1>
          {description && <p className="ds-description">{description}</p>}
        </div>
        {actions && <div className="ds-page-header-actions">{actions}</div>}
      </header>
    </>
  );
}

/** "← Roles": back to the list a detail page belongs to. Takes the same props as the router's `Link`. */
export function BackLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link className={cn("ds-back", className as string | undefined)} {...props}>
      <ArrowLeft aria-hidden="true" />
      {children as ReactNode}
    </Link>
  );
}
