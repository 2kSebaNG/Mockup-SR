import type { components } from './api/schema';

type AccountDetail = components['schemas']['AccountDetail'];

/**
 * Sharing a total out among the months of an account to make its projection: how much goes to
 * each month, which months cannot take any, and what that changes. Pure on purpose: the panel
 * that does it shows the plan, and only what the person accepts becomes cells.
 */

/** How the total is shared among the months. */
export type SpreadShape = 'even' | 'budget' | 'rising' | 'falling' | 'manual';

export const SPREAD_SHAPES: { key: SpreadShape; label: string; hint: string }[] = [
  { key: 'even', label: 'Parejo', hint: 'La misma parte para cada mes.' },
  {
    key: 'budget',
    label: 'Según el presupuesto',
    hint: 'Más donde el presupuesto de ese mes es mayor.',
  },
  { key: 'rising', label: 'Creciente', hint: 'Cada mes un poco más que el anterior.' },
  { key: 'falling', label: 'Decreciente', hint: 'Cada mes un poco menos que el anterior.' },
  { key: 'manual', label: 'A mano', hint: 'Tú dices cuántas partes lleva cada mes.' },
];

/** What an account has in one month. */
export interface SpreadMonth {
  period: string;
  budget: number | null;
  /** The real: a month that has it cannot take a projection. */
  actual: number | null;
  /** The projection the month holds now, draft included. */
  forecast: number | null;
  /** The month is made of concepts: it is changed through them, never by sharing a total. */
  locked?: boolean;
}

/** The months of an account, in order, with what it holds in each. */
export function monthsOfAccount(
  account: AccountDetail,
  periods: string[],
  locked: ReadonlySet<string> = new Set(),
): SpreadMonth[] {
  return [...periods].sort().map((period) => {
    const cell = account.byPeriod[period];
    return {
      period,
      budget: cell?.budget ?? null,
      actual: cell?.actual ?? null,
      forecast: cell?.forecast ?? null,
      locked: locked.has(period),
    };
  });
}

/** What is left of the account's budget once the real is taken out, or `null` with no budget. */
export function budgetBalance(months: SpreadMonth[]): number | null {
  const budgeted = months.filter((month) => month.budget !== null);
  if (budgeted.length === 0) return null;
  const budget = months.reduce((sum, month) => sum + (month.budget ?? 0), 0);
  const actual = months.reduce((sum, month) => sum + (month.actual ?? 0), 0);
  return budget - actual;
}

/** The months a total can go to: the ones from `from` to `to` that have no real yet and, when
 * asked to respect what is projected, no projection either. */
export function targetMonths(
  months: SpreadMonth[],
  from: string,
  to: string,
  onlyEmpty: boolean,
): SpreadMonth[] {
  return months.filter(
    (month) =>
      month.period >= from &&
      month.period <= to &&
      month.actual === null &&
      !month.locked &&
      !(onlyEmpty && month.forecast !== null),
  );
}

/** The parts each of these months takes, by shape. The ones without any budget (or manual part)
 * of their own take none; when no month has any, the shape cannot tell and it is even. */
export function shapeWeights(
  shape: SpreadShape,
  months: SpreadMonth[],
  manual: Readonly<Record<string, number>> = {},
): number[] {
  const count = months.length;
  const raw = (() => {
    switch (shape) {
      case 'even':
        return months.map(() => 1);
      case 'budget':
        return months.map((month) => Math.max(month.budget ?? 0, 0));
      case 'rising':
        return months.map((_, index) => index + 1);
      case 'falling':
        return months.map((_, index) => count - index);
      case 'manual':
        return months.map((month) => Math.max(manual[month.period] ?? 0, 0));
    }
  })();
  if (shape === 'manual') return raw;
  return raw.some((weight) => weight > 0) ? raw : months.map(() => 1);
}

/**
 * `total` shared out in proportion to the weights, in whole pesos (the app projects in whole
 * pesos), by largest remainder so the parts add up to the total exactly. All-zero weights share
 * nothing.
 */
export function distribute(total: number, weights: number[]): number[] {
  const pesos = Math.round(total);
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (weights.length === 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (pesos * weight) / sum);
  const parts = exact.map((value) => Math.floor(value));
  let left = pesos - parts.reduce((acc, part) => acc + part, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    parts[index]! += 1;
    left -= 1;
  }
  return parts;
}

/** Why a month of the range does not get a part. */
export type SpreadSkip = 'real' | 'kept' | 'concepts' | 'none';

export interface SpreadRow extends SpreadMonth {
  /** What the month would hold; `null` when it is left as it is. */
  amount: number | null;
  skip: SpreadSkip | null;
}

export interface SpreadInput {
  months: SpreadMonth[];
  from: string;
  to: string;
  total: number;
  shape: SpreadShape;
  manual?: Readonly<Record<string, number>>;
  /** Respect the months that are already projected and share the total among the empty ones. */
  onlyEmpty: boolean;
}

export interface SpreadPlan {
  /** Every month of the range, with what it would hold. */
  rows: SpreadRow[];
  /** The cells that would change, as they are given to the grid. */
  changes: { period: string; amount: number }[];
  /** How many of those replace a projection that was there. */
  replaced: number;
  /** What the months of the range would add up to once applied, parts and what is kept. */
  total: number;
  /** Why there is nothing to apply, or `undefined`. */
  problem?: string | undefined;
}

export function planSpread(input: SpreadInput): SpreadPlan {
  const inRange = input.months.filter(
    (month) => month.period >= input.from && month.period <= input.to,
  );
  const targets = targetMonths(input.months, input.from, input.to, input.onlyEmpty);
  const amounts = new Map<string, number>();
  let problem: string | undefined;

  if (input.from > input.to) {
    problem = 'El mes de inicio no puede ser posterior al de término.';
  } else if (!Number.isFinite(input.total) || input.total < 1) {
    problem = 'El total tiene que ser mayor que cero.';
  } else if (targets.length === 0) {
    problem =
      inRange.length === 0
        ? 'Elige meses que tenga el proyecto.'
        : 'En esos meses no se puede proyectar: ya tienen real, proyección o conceptos.';
  } else {
    const weights = shapeWeights(input.shape, targets, input.manual);
    if (weights.every((weight) => weight === 0)) {
      problem = 'Pon cuántas partes lleva al menos un mes.';
    } else {
      distribute(input.total, weights).forEach((amount, index) => {
        amounts.set(targets[index]!.period, amount);
      });
    }
  }

  const rows: SpreadRow[] = inRange.map((month) => {
    if (month.actual !== null) return { ...month, amount: null, skip: 'real' };
    if (month.locked) return { ...month, amount: null, skip: 'concepts' };
    if (input.onlyEmpty && month.forecast !== null) return { ...month, amount: null, skip: 'kept' };
    // A month that takes no part (a manual 0, or a total too small to reach it) is left as it
    // is: a projection of nothing is not the same as no projection.
    const amount = amounts.get(month.period);
    if (amount === undefined || amount === 0) {
      return { ...month, amount: null, skip: 'none' };
    }
    return { ...month, amount, skip: null };
  });

  const changes = problem
    ? []
    : rows
        .filter((row) => row.amount !== null && row.amount !== row.forecast)
        .map((row) => ({ period: row.period, amount: row.amount as number }));
  const replaced = problem
    ? 0
    : rows.filter(
        (row) => row.amount !== null && row.forecast !== null && row.amount !== row.forecast,
      ).length;
  const total = rows.reduce((sum, row) => sum + (row.amount ?? row.forecast ?? 0), 0);
  return { rows, changes, replaced, total, problem };
}

/** The first and last month of the range to start with: from the first month with no real to the
 * last month the project has. */
export function defaultRange(months: SpreadMonth[]): { from: string; to: string } {
  if (months.length === 0) return { from: '', to: '' };
  const open = months.find((month) => month.actual === null) ?? months[months.length - 1];
  return { from: open!.period, to: months[months.length - 1]!.period };
}
