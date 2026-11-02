import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneClass, type Tone } from "./tone";

/** A figure with its label and a hint, with an edge in its tone. For dashboards with charts use `KpiRow`. */
export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className={cn("ds-stat", tone && toneClass(tone))}>
      <span className="ds-stat-label">{label}</span>
      <span className="ds-stat-value">{value}</span>
      {hint && <span className="ds-stat-hint">{hint}</span>}
    </div>
  );
}

/** Stats in as many columns as fit. */
export function StatRow({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ds-stat-row", className)} {...props} />;
}
