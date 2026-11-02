import { Check, X } from "lucide-react";

/**
 * Where a record is in its flow (Borrador → Enviada → Aprobada → Pagada). Steps before `current` are done; the
 * current one is highlighted, or marked as failed (`failed`: a rejected order stops there).
 */
export function Stepper({ label, steps, current, failed = false }: { label: string; steps: string[]; current: number; failed?: boolean }) {
  return (
    <ol className="ds-stepper" aria-label={label}>
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? (failed ? "failed" : "current") : "next";
        return (
          <li key={step} data-state={state} aria-current={index === current ? "step" : undefined}>
            <span className="ds-stepper-dot" aria-hidden="true">{state === "done" ? <Check /> : state === "failed" ? <X /> : index + 1}</span>
            <span className="ds-stepper-label">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The index of a step by its name, for `Stepper`'s `current` (the first one when it is not in the list). */
export const stepOf = (steps: string[], step: string) => Math.max(0, steps.indexOf(step));

