import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const digits = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

/** "$ 1.234.567": whole pesos, as they are read. */
export const formatMoney = (value: number | null | undefined) => (value === null || value === undefined ? "" : digits.format(value));

/**
 * An amount in pesos: shows the thousands as they are typed, with "$" in front, and hands back the number (null
 * while empty). Only digits; pesos have no decimals.
 */
export function MoneyInput({ value, onValueChange, className, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null; onValueChange: (value: number | null) => void;
}) {
  return (
    <div className={cn("ds-affix-input", className)}>
      <span className="ds-affix" aria-hidden="true">$</span>
      <Input {...props} type="text" inputMode="numeric" autoComplete="off" value={formatMoney(value)}
        onChange={event => { const raw = event.target.value.replace(/\D/g, "").slice(0, 15); onValueChange(raw ? Number(raw) : null); }} />
    </div>
  );
}
