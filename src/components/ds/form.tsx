import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Fields side by side (2 by default); one per row on phones. Use shadcn `Field` inside. */
export function FormRow({ columns = 2, className, style, ...props }: ComponentProps<"div"> & { columns?: 2 | 3 | 4 }) {
  return <div className={cn("ds-form-row", className)} style={{ "--ds-columns": columns, ...style } as CSSProperties} {...props} />;
}

/**
 * Cancel and confirm, at the end: secondary (outline) first, primary last. `sticky` keeps them on the bottom edge
 * of a scrolling dialog body.
 */
export function FormActions({ sticky = false, className, ...props }: ComponentProps<"div"> & { sticky?: boolean }) {
  return <div className={cn("ds-form-actions", sticky && "ds-form-actions--sticky", className)} {...props} />;
}

/** "(opcional)" after a label. */
export function Optional() {
  return <span className="ds-optional">(opcional)</span>;
}
