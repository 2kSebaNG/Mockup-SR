import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, FlaskConical, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClass } from "./tone";

export type CalloutVariant = "note" | "info" | "warning" | "success" | "danger" | "sample";

const icons: Record<CalloutVariant, ReactNode> = {
  note: <Info aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  warning: <TriangleAlert aria-hidden="true" />,
  success: <CircleCheck aria-hidden="true" />,
  danger: <CircleAlert aria-hidden="true" />,
  sample: <FlaskConical aria-hidden="true" />,
};

/**
 * A message inside the page.
 * - note: graphite band with the red edge, for what the page wants read first.
 * - info / warning / success: soft fill of that tone.
 * - danger: an error; it is announced (role="alert").
 * - sample: what is on screen is example data.
 */
export function Callout({ variant = "info", title, icon, children, className }: {
  variant?: CalloutVariant; title?: ReactNode; icon?: ReactNode; children?: ReactNode; className?: string;
}) {
  const tone = variant === "info" || variant === "warning" || variant === "success" ? toneClass(variant) : undefined;
  return (
    <div role={variant === "danger" ? "alert" : undefined} className={cn("ds-callout", `ds-callout--${variant}`, tone, className)}>
      {icon ?? icons[variant]}
      <div className="ds-callout-body">
        {title && <span className="ds-callout-title">{title}</span>}
        {children && <span>{children}</span>}
      </div>
    </div>
  );
}
