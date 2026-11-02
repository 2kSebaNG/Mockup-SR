import type { components } from './api/schema';
import { analyzeAmountInput } from './formula';
import { createFormulaContext } from './formula-refs';
import { formatDate } from './format';

export type Calculation = components['schemas']['Calculation'];
type AccountDetail = components['schemas']['AccountDetail'];

/** What a calculation reads: the report as it is on screen. */
export interface CalculationContext {
  accounts: AccountDetail[];
  periods: string[];
}

export type Evaluation =
  | { ok: true; value: number | null; steps: string[]; warnings: string[] }
  | { ok: false; error: string };

/** The month a calculation is read in: the one it names when the project has it, otherwise the
 * project's latest. */
export function periodFor(period: string | null, periods: string[]): string | null {
  if (periods.length === 0) return null;
  if (period && periods.includes(period)) return period;
  return periods[periods.length - 1]!;
}

/** Works out a formula the way a cell does — the same references, the same operations — read in
 * `period` of the report in `context`. A blank formula is nothing (`value: null`). */
export function evaluateCalculation(
  formula: string,
  period: string | null,
  context: CalculationContext,
): Evaluation {
  const at = periodFor(period, context.periods);
  if (!at) return { ok: false, error: 'El proyecto todavía no tiene meses con cifras.' };
  const analysis = analyzeAmountInput(
    formula,
    createFormulaContext({
      accounts: context.accounts,
      periods: context.periods,
      cell: { chartAccountId: '', period: at },
    }),
  );
  switch (analysis.kind) {
    case 'error':
      return { ok: false, error: analysis.error };
    case 'blank':
      return { ok: true, value: null, steps: [], warnings: [] };
    case 'amount':
      return { ok: true, value: analysis.value, steps: [], warnings: [] };
    default:
      return {
        ok: true,
        value: analysis.value,
        steps: analysis.steps,
        warnings: analysis.warnings,
      };
  }
}

/** Whether what was worked out is different from what is saved, so the author's saved figure is
 * brought up to date. Pesos are kept to the cent. */
export function needsSaving(value: number | null, saved: number | null): boolean {
  if (value === null) return false;
  if (saved === null) return true;
  return Math.round(value * 100) !== Math.round(saved * 100);
}

/** Who sees it, in words: only its author, or the roles it was shared with. */
export function visibilityText(calculation: Pick<Calculation, 'visibleToRoles'>): string {
  return calculation.visibleToRoles.length === 0
    ? 'Solo su autor'
    : `Visible para ${calculation.visibleToRoles.join(', ')}`;
}

/** When the saved figure was worked out, for the note under it. */
export function savedNote(
  calculation: Pick<Calculation, 'lastCalculatedAt' | 'createdByName'>,
): string {
  if (!calculation.lastCalculatedAt) return 'Sin valor guardado todavía';
  const by = calculation.createdByName ? ` por ${calculation.createdByName}` : '';
  return `Calculado${by} el ${formatDate(calculation.lastCalculatedAt.slice(0, 10))}`;
}
