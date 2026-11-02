import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nothing to show: an icon, what happened and what to do next (usually one button). `inline` sits inside a panel
 * or a list instead of being its own card.
 */
export function EmptyState({ icon, title, children, action, inline = false }: {
  icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; inline?: boolean;
}) {
  return (
    <div className={cn("ds-empty", inline && "ds-empty--inline")}>
      {icon}
      <h2 className="ds-empty-title">{title}</h2>
      {children && <p className="ds-empty-text">{children}</p>}
      {action}
    </div>
  );
}
