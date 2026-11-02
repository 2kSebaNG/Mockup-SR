import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The white card every block of a page sits in (1px border, --radius, no shadow). `flush` drops the padding for
 * content that reaches the edges, like a table; its header then gets a bottom border.
 */
export function Panel({ title, description, actions, flush = false, as: Tag = "section", className, children, ...props }: Omit<ComponentProps<"section">, "title" | "ref"> & {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; flush?: boolean; as?: "section" | "aside" | "div" | "article";
}) {
  return (
    <Tag className={cn("ds-panel", flush && "ds-panel--flush", className)} {...props}>
      {(title || actions) && (
        <div className="ds-panel-header">
          <div>
            {title && <h2 className="ds-panel-title">{title}</h2>}
            {description && <p className="ds-panel-description">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Blocks one under the other with the standard gap. */
export function Stack({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ds-stack", className)} {...props} />;
}

/** Main content and a 320px side column (members, metadata); one column under 1100px. */
export function Split({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ds-split", className)} {...props} />;
}
