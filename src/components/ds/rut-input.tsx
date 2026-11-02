import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { formatRut, normalizeRut } from "@/lib/access";

/** Why a typed RUT cannot be used, or null when it can (or is still empty). */
export const rutProblem = (value: string) => (value.trim() === "" || normalizeRut(value) ? null : "El RUT no es válido. Revisa el dígito verificador.");

/**
 * A Chilean RUT: typed however (with or without dots or dash), written as "12.345.678-5" when the field is left, and
 * marked invalid while its check digit does not match. Show `rutProblem(value)` in the field's `FieldError`.
 */
export function RutInput({ value, onValueChange, onBlur, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string; onValueChange: (value: string) => void;
}) {
  return (
    <Input {...props} autoComplete="off" placeholder={props.placeholder ?? "12.345.678-5"} value={value} aria-invalid={props["aria-invalid"] ?? Boolean(rutProblem(value))}
      onChange={event => onValueChange(event.target.value)}
      onBlur={event => { const normalized = normalizeRut(value); if (normalized) onValueChange(formatRut(normalized)); onBlur?.(event); }} />
  );
}
