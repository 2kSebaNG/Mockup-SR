import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneClass, type Tone } from "./tone";

/** A status: soft fill in its tone, rounded pill. Use it for state only, never for categories or counts. */
export function Badge({ tone, icon, children, className, ...props }: ComponentProps<"span"> & { tone: Tone; icon?: ReactNode }) {
  return <span className={cn("ds-badge", toneClass(tone), className)} {...props}>{icon}{children}</span>;
}

/** A neutral label (a role, a category). As a link it takes the link color. */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ds-tag", className)} {...props} />;
}

/** Tags in a wrapping row. */
export function Tags({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ds-tags", className)} {...props} />;
}
