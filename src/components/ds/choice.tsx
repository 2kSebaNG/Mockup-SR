import type { CSSProperties, ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Choice cards in as many columns as fit, each at least `min` px wide (one column on phones). */
export function ChoiceGrid({ min = 240, children }: { min?: number; children: ReactNode }) {
  return <div className="ds-choice-grid" style={{ "--ds-choice-min": `${min}px` } as CSSProperties}>{children}</div>;
}

/**
 * A checkbox as a bordered card with a title and a description; checked, it takes the brand edge. `locked`
 * keeps its value and says why in the description.
 */
export function ChoiceCard({ id, title, description, checked, locked = false, onCheckedChange }: {
  id: string; title: ReactNode; description?: ReactNode; checked: boolean; locked?: boolean; onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className={cn("ds-choice", locked && "ds-choice--locked")}>
      <Checkbox id={id} checked={checked} disabled={locked} onCheckedChange={value => onCheckedChange?.(value === true)} />
      <span className="ds-choice-text">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </span>
    </label>
  );
}
