import type { components } from './api/schema';

export type ForecastItem = components['schemas']['ForecastItem'];

/** The concept a cell's own figure becomes when the cell is broken down for the first time. */
export const UNBROKEN_CONCEPT = 'Sin desglosar';

/** The cells (account and month, as the grid keys them) that are made of concepts: they can no
 * longer be typed over, their concepts are what changes them. */
export function breakdownKeys(items: ForecastItem[]): Set<string> {
  return new Set(items.map((item) => `${item.chartAccountId}|${item.period}`));
}

/** What one month of a concept holds. */
export interface ConceptCell {
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
}

/** A concept of an account across the months it has. */
export interface ConceptRow {
  concept: string;
  /** The unit price its months share, or `null` when it is worked in amounts. */
  unitPrice: number | null;
  cells: Record<string, ConceptCell>;
  total: number;
}

/** The concepts of an account, "Sin desglosar" first and the rest by name. */
export function conceptsOf(items: ForecastItem[], chartAccountId: string): ConceptRow[] {
  const byConcept = new Map<string, ConceptRow>();
  for (const item of items) {
    if (item.chartAccountId !== chartAccountId) continue;
    const row = byConcept.get(item.concept) ?? {
      concept: item.concept,
      unitPrice: null,
      cells: {},
      total: 0,
    };
    row.cells[item.period] = {
      amount: item.amount,
      quantity: item.quantity ?? null,
      unitPrice: item.unitPrice ?? null,
    };
    row.unitPrice = row.unitPrice ?? item.unitPrice ?? null;
    row.total = Math.round((row.total + item.amount) * 100) / 100;
    byConcept.set(item.concept, row);
  }
  return [...byConcept.values()].sort((a, b) => {
    if (a.concept === UNBROKEN_CONCEPT) return -1;
    if (b.concept === UNBROKEN_CONCEPT) return 1;
    return a.concept.localeCompare(b.concept, 'es');
  });
}

/** What the concepts of an account add up to in each month: the projection of the account there. */
export function monthTotals(rows: ConceptRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const [period, cell] of Object.entries(row.cells)) {
      totals[period] = Math.round(((totals[period] ?? 0) + cell.amount) * 100) / 100;
    }
  }
  return totals;
}

/** A number typed in a cell of a concept: whole or with a decimal comma or point ("2,5"), and
 * `null` for what is not one. A blank is `null` too: it clears the cell. */
export function parseQuantity(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (clean === '') return null;
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

/** What typing a value in a month of a concept saves: in a concept with a unit price the value is
 * the quantity and the amount their product; otherwise it is the amount. `null` when it is not a
 * number (and a blank, which clears the month, is told apart by the caller). */
export function monthPayload(
  typed: string,
  unitPrice: number | null,
): { amount?: number; quantity?: number; unitPrice?: number } | null {
  const value = parseQuantity(typed);
  if (value === null) return null;
  if (unitPrice !== null) return { quantity: value, unitPrice };
  return { amount: Math.round(value) };
}

/** What a month of a concept shows in its box: the quantity in a concept worked with a unit
 * price, the amount in one worked in amounts. */
export function monthShown(cell: ConceptCell | undefined, unitPrice: number | null): string {
  if (!cell) return '';
  if (unitPrice !== null && cell.quantity !== null) return String(cell.quantity);
  return String(cell.amount);
}

/**
 * What changing the unit price of a concept does to the months it has, as the writes to make: with
 * a new price each month keeps its quantity (or, if it was worked in amounts, takes the quantity
 * that makes the same amount), and with none each month keeps the amount it was worth.
 */
export function repriceWrites(
  row: ConceptRow,
  unitPrice: number | null,
): { period: string; amount?: number; quantity?: number; unitPrice?: number }[] {
  return Object.entries(row.cells).map(([period, cell]) => {
    if (unitPrice === null) return { period, amount: cell.amount };
    if (unitPrice === 0) return { period, quantity: cell.quantity ?? 0, unitPrice };
    const quantity = cell.quantity ?? Math.round((cell.amount / unitPrice) * 10000) / 10000;
    return { period, quantity, unitPrice };
  });
}

/** Why a name cannot be given to a concept, or `undefined` when it can: it needs a name, and an
 * account does not repeat its concepts. */
export function conceptNameProblem(name: string, existing: string[]): string | undefined {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return 'El concepto necesita un nombre.';
  if (existing.some((other) => other.toLowerCase() === clean.toLowerCase())) {
    return 'Esa cuenta ya tiene un concepto con ese nombre.';
  }
  return undefined;
}
