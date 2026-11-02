import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string; count?: number | undefined };

/**
 * One choice out of a few, as connected buttons with the count of each ("Pendientes 4"): the status filter above a
 * list. Scrolls sideways inside itself on phones.
 */
export function SegmentedFilter<T extends string>({ label, options, value, onChange, className }: {
  label: string; options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("ds-segmented", className)}>
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count !== undefined && <span className="ds-segmented-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
