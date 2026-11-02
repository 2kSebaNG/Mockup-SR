import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The card above a list with its search and filters. Fields share the row and wrap; whatever goes in `end`
 * (clear filters, a secondary link) sits at the right.
 */
export function FilterBar({ label = "Filtros", end, children }: { label?: string; end?: ReactNode; children: ReactNode }) {
  return (
    <section className="ds-filter-bar" aria-label={label}>
      {children}
      {end && <div className="ds-filter-bar-end">{end}</div>}
    </section>
  );
}

/** A labelled control of the filter bar. `grow` takes twice the room (search). */
export function FilterField({ id, label, grow = false, children }: { id: string; label: ReactNode; grow?: boolean; children: ReactNode }) {
  return (
    <div className={cn("ds-field", grow && "ds-field--grow")}>
      <label htmlFor={id} className="ds-field-label">{label}</label>
      {children}
    </div>
  );
}

/** A search box with the magnifier inside. */
export function SearchInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className={cn("ds-search", className)}>
      <Search aria-hidden="true" />
      <Input type="search" {...props} />
    </div>
  );
}
