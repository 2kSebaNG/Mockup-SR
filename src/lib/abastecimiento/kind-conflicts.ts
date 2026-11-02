import type { components } from './api/schema';
import { formatAmount } from './format';

export type KindConflict = components['schemas']['ChartAccountKindConflict'];

const movements = (count: number) => `${count} ${count === 1 ? 'movimiento' : 'movimientos'}`;

/**
 * What is wrong with an account, in one sentence: its kind against what is booked to it, with how
 * much, and what that does to the return.
 */
export function conflictText(conflict: KindConflict): string {
  const sales = `${movements(conflict.salesCount)} de venta (${formatAmount(conflict.salesTotal)})`;
  const costs = `${movements(conflict.costCount)} de costo (${formatAmount(conflict.costTotal)})`;
  const mixed = conflict.salesCount > 0 && conflict.costCount > 0;
  if (conflict.problem === 'SALES_ON_COST') {
    const base = `Está marcada como costo, pero tiene ${sales}: el retorno las cuenta como costos.`;
    return mixed ? `${base} También tiene ${costs}.` : base;
  }
  const base = `Está marcada como ingreso, pero tiene ${costs}: el retorno las cuenta como ventas.`;
  return mixed ? `${base} También tiene ${sales}.` : base;
}

/** What to do about an account that has both sales and costs: no kind fits it. */
export const MIXED_ADVICE =
  'Tiene ventas y costos a la vez: cambiarle el tipo solo daría vuelta cuál de los dos queda mal. Sus movimientos tendrían que estar en cuentas distintas.';

/** The label of the button that fixes an account, from the kind it would get. */
export function fixLabel(suggested: 'INCOME' | 'COST'): string {
  return suggested === 'INCOME' ? 'Marcar como ingreso' : 'Marcar como costo';
}

/** How many accounts can be fixed by changing their kind, and how many are mixed. */
export function conflictCounts(conflicts: KindConflict[]): { fixable: number; mixed: number } {
  const fixable = conflicts.filter((conflict) => conflict.suggestedKind !== null).length;
  return { fixable, mixed: conflicts.length - fixable };
}
