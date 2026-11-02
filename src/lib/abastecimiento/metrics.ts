import type { components } from './api/schema';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];
type PortfolioItem = components['schemas']['PortfolioItem'];

export type AccountKind = 'INCOME' | 'COST';

/** Below this many pesos a difference is rounding, not data. */
const MATERIAL = 0.5;

function emptyCell(): SummaryCell {
  return { budget: null, actual: null, forecast: null, reported: null };
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0);
}

/** What a group holds beyond its children: its cell less theirs, blank when it is rounding. */
function ownOf(group: SummaryCell, children: SummaryCell[]): SummaryCell {
  const rest = (pick: (cell: SummaryCell) => number | null) => {
    const value = pick(group);
    if (value === null) return null;
    const left = value - (sum(children.map(pick)) ?? 0);
    return Math.abs(left) < MATERIAL ? null : left;
  };
  return {
    budget: rest((cell) => cell.budget),
    actual: rest((cell) => cell.actual),
    forecast: rest((cell) => cell.forecast),
    reported: rest((cell) => cell.reported),
  };
}

/** What the share of a group that was posted straight to it (to no sub-account) is called. */
export function ownName(name: string): string {
  return `${name} (sin subcuenta)`;
}

export interface HeldAccount {
  chartAccountId: string;
  name: string;
  kind: AccountKind;
  byPeriod: Record<string, SummaryCell>;
  totals: SummaryCell;
}

/** The accounts that hold figures of their own — a leaf, or what was posted straight to a
 * group — which is what can be added up without counting anything twice. */
export function heldAccounts(
  roots: AccountDetail[],
  periods: string[],
  kindOf: ReadonlyMap<string, AccountKind>,
): HeldAccount[] {
  const held: HeldAccount[] = [];
  const walk = (node: AccountDetail) => {
    const kind = kindOf.get(node.chartAccountId) ?? 'COST';
    if (node.children.length === 0) {
      held.push({
        chartAccountId: node.chartAccountId,
        name: node.name,
        kind,
        byPeriod: node.byPeriod,
        totals: node.totals,
      });
      return;
    }
    const cellOf = (account: AccountDetail, period: string) =>
      period === 'total' ? account.totals : (account.byPeriod[period] ?? emptyCell());
    const own = (period: string) =>
      ownOf(
        cellOf(node, period),
        node.children.map((child) => cellOf(child, period)),
      );
    const totals = own('total');
    if ((totals.reported ?? 0) !== 0 || (totals.budget ?? 0) !== 0) {
      held.push({
        chartAccountId: node.chartAccountId,
        name: ownName(node.name),
        kind,
        byPeriod: Object.fromEntries(periods.map((period) => [period, own(period)])),
        totals,
      });
    }
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return held;
}

function sumCells(cells: SummaryCell[]): SummaryCell {
  return {
    budget: sum(cells.map((cell) => cell.budget)),
    actual: sum(cells.map((cell) => cell.actual)),
    forecast: sum(cells.map((cell) => cell.forecast)),
    reported: sum(cells.map((cell) => cell.reported)),
  };
}

/**
 * The project's total of one kind of account (what it costs, what it sells), as a row the table
 * can draw like any other: every month and the whole span, added up over the accounts that hold
 * figures of their own, so nothing is counted twice. `null` when the project has none of that
 * kind. This is the total of the project, apart from the totals of each account.
 */
export function kindTotalsRow(
  held: HeldAccount[],
  periods: string[],
  kind: AccountKind,
  name: string,
): AccountDetail | null {
  const mine = held.filter((account) => account.kind === kind);
  const totals = sumCells(mine.map((account) => account.totals));
  if (
    mine.length === 0 ||
    ((totals.budget ?? 0) === 0 && (totals.reported ?? 0) === 0 && (totals.actual ?? 0) === 0)
  ) {
    return null;
  }
  return {
    chartAccountId: `total:${kind}`,
    code: '',
    name,
    parentAccountId: null,
    byPeriod: Object.fromEntries(
      periods.map((period) => [
        period,
        sumCells(mine.map((account) => account.byPeriod[period] ?? emptyCell())),
      ]),
    ),
    totals,
    children: [],
  };
}

export interface MonthPoint {
  period: string;
  /** What the purchase orders and the like already say it was. */
  real: number;
  /** What is still a projection: a month with no real yet. */
  projected: number;
  /** Real + projected, accumulated up to and including this month. */
  cumulative: number;
  cumulativeReal: number;
  /** What was budgeted for the month, and the budget accumulated up to and including it. */
  budget: number;
  cumulativeBudget: number;
  /** What was projected for the month, whether or not it already has a real figure: the
   * projection next to what really happened, where `projected` is only what is still to come. */
  forecast: number;
}

export interface KindSeries {
  points: MonthPoint[];
  budget: number;
  real: number;
  projected: number;
  reported: number;
}

/** The months of one kind of account (costs, or income): what is real, what is projected, and the
 * running totals — the curve a project follows. */
export function seriesOf(held: HeldAccount[], periods: string[], kind: AccountKind): KindSeries {
  const mine = held.filter((account) => account.kind === kind);
  let cumulative = 0;
  let cumulativeReal = 0;
  let cumulativeBudget = 0;
  const points = periods.map((period) => {
    let real = 0;
    let projected = 0;
    let budget = 0;
    let forecast = 0;
    for (const account of mine) {
      const cell = account.byPeriod[period];
      if (!cell) continue;
      if (cell.actual !== null) real += cell.actual;
      else projected += cell.forecast ?? 0;
      budget += cell.budget ?? 0;
      forecast += cell.forecast ?? 0;
    }
    cumulative += real + projected;
    cumulativeReal += real;
    cumulativeBudget += budget;
    return {
      period,
      real,
      projected,
      cumulative,
      cumulativeReal,
      budget,
      cumulativeBudget,
      forecast,
    };
  });
  const real = points.reduce((total, point) => total + point.real, 0);
  const projected = points.reduce((total, point) => total + point.projected, 0);
  return {
    points,
    budget: mine.reduce((total, account) => total + (account.totals.budget ?? 0), 0),
    real,
    projected,
    reported: real + projected,
  };
}

export interface AccountShare {
  chartAccountId: string;
  name: string;
  budget: number;
  reported: number;
}

/** How far down the tree the accounts compared go: 'auto' opens the single group that holds the
 * costs, a number is that many levels from the top (1 is the top-level groups), 'leaves' goes
 * down to the accounts that have no sub-accounts. */
export type AccountLevel = 'auto' | 'leaves' | number;

interface KindFigures {
  budget: number;
  reported: number;
}

/**
 * What a subtree holds of one kind. A group does not have to be of the same kind as what is under
 * it — a sale posted straight to "Arriendo" makes the group income while its sub-accounts stay
 * costs — so each account counts by its own kind: what a group holds of its own (posted to it and
 * to none of its sub-accounts) counts when the group is of the kind, and what its sub-accounts
 * hold counts when they are.
 */
function figuresOfKind(
  node: AccountDetail,
  kindOf: ReadonlyMap<string, AccountKind>,
  kind: AccountKind,
): KindFigures {
  const mine = (kindOf.get(node.chartAccountId) ?? 'COST') === kind;
  const own =
    node.children.length === 0
      ? node.totals
      : ownOf(
          node.totals,
          node.children.map((child) => child.totals),
        );
  const figures: KindFigures = mine
    ? { budget: own.budget ?? 0, reported: own.reported ?? 0 }
    : { budget: 0, reported: 0 };
  for (const child of node.children) {
    const part = figuresOfKind(child, kindOf, kind);
    figures.budget += part.budget;
    figures.reported += part.reported;
  }
  return figures;
}

/** Whether a subtree holds anything of the kind. */
function holdsKind(
  node: AccountDetail,
  kindOf: ReadonlyMap<string, AccountKind>,
  kind: AccountKind,
): boolean {
  const { budget, reported } = figuresOfKind(node, kindOf, kind);
  return budget > MATERIAL || reported > MATERIAL;
}

/** How many levels the accounts of a kind have, counting the one that has no sub-accounts. */
export function treeDepth(
  roots: AccountDetail[],
  kindOf: ReadonlyMap<string, AccountKind>,
  kind: AccountKind = 'COST',
): number {
  const depth = (node: AccountDetail): number =>
    1 +
    node.children
      .filter((child) => holdsKind(child, kindOf, kind))
      .reduce((deepest, child) => Math.max(deepest, depth(child)), 0);
  return roots
    .filter((root) => holdsKind(root, kindOf, kind))
    .reduce((deepest, root) => Math.max(deepest, depth(root)), 0);
}

/**
 * The accounts worth comparing, most spent first, at the chosen level. A group counts its whole
 * subtree of the kind, which is what its budget is compared with; when a group is opened, what
 * was posted straight to it (to no sub-account) is one more account so the parts still add up to
 * the whole. A group of another kind is still a group: "Arriendo" with a sale posted to it shows
 * what its sub-accounts spent, and leaves the sale out.
 * 'auto' is for a project whose costs sit under one or two top-level groups ("Costos directos"):
 * a single root is opened to show what is in it.
 */
export function accountsAtLevel(
  roots: AccountDetail[],
  kindOf: ReadonlyMap<string, AccountKind>,
  kind: AccountKind = 'COST',
  level: AccountLevel = 'auto',
): AccountShare[] {
  const holding = (list: AccountDetail[]) => list.filter((node) => holdsKind(node, kindOf, kind));
  let nodes = holding(roots);
  const extras: AccountShare[] = [];
  const open = (list: AccountDetail[]) =>
    list.flatMap((node) => {
      const below = holding(node.children);
      if (below.length === 0) return [node];
      if ((kindOf.get(node.chartAccountId) ?? 'COST') === kind) {
        const own = ownOf(
          node.totals,
          node.children.map((child) => child.totals),
        );
        extras.push({
          chartAccountId: `${node.chartAccountId}:own`,
          name: ownName(node.name),
          budget: own.budget ?? 0,
          reported: own.reported ?? 0,
        });
      }
      return below;
    });
  const opened = (list: AccountDetail[]) => list.some((node) => holding(node.children).length > 0);

  if (level === 'auto') {
    while (nodes.length === 1 && opened(nodes)) nodes = open(nodes);
  } else {
    const steps = level === 'leaves' ? Infinity : Math.max(0, level - 1);
    for (let step = 0; step < steps && opened(nodes); step += 1) nodes = open(nodes);
  }
  return [
    ...nodes.map((node) => ({
      chartAccountId: node.chartAccountId,
      name: node.name,
      ...figuresOfKind(node, kindOf, kind),
    })),
    ...extras,
  ]
    .filter((account) => account.budget > MATERIAL || account.reported > MATERIAL)
    .sort((a, b) => b.reported - a.reported);
}

/** The accounts worth comparing at the level that suits the project (see `accountsAtLevel`). */
export function mainAccounts(
  roots: AccountDetail[],
  kindOf: ReadonlyMap<string, AccountKind>,
  kind: AccountKind = 'COST',
): AccountShare[] {
  return accountsAtLevel(roots, kindOf, kind, 'auto');
}

/** The biggest `limit` accounts, and everything else as one more ("Otras"). */
export function topWithRest(accounts: AccountShare[], limit: number): AccountShare[] {
  if (accounts.length <= limit) return accounts;
  const rest = accounts.slice(limit);
  return [
    ...accounts.slice(0, limit),
    {
      chartAccountId: 'rest',
      name: 'Otras',
      budget: rest.reduce((total, account) => total + account.budget, 0),
      reported: rest.reduce((total, account) => total + account.reported, 0),
    },
  ];
}

export interface PortfolioMetrics {
  projects: number;
  budget: number;
  real: number;
  projected: number;
  reported: number;
  /** Share of the budget that real + projected comes to; `null` with no budget. */
  consumed: number | null;
  /** Projects whose return is negative. */
  atRisk: number;
  /** Projects that are at or past their budget (what they report is above what is budgeted). */
  overBudget: number;
  /** Average of the returns that are known (a project with no sales yet has none). */
  averageReturn: number | null;
  /** How many projects have a return to average. */
  withReturn: number;
  /** What real + projected comes to above (positive) or below (negative) the budget, over the
   * whole portfolio: the same difference as the grid's "Variación". */
  variance: number;
  /** The variance as a share of the budget; `null` with no budget. */
  variancePercent: number | null;
  byStatus: { status: PortfolioItem['status']; count: number }[];
}

export function portfolioMetrics(items: PortfolioItem[]): PortfolioMetrics {
  const budget = items.reduce((total, item) => total + item.totalBudget, 0);
  const real = items.reduce((total, item) => total + item.totalActual, 0);
  const projected = items.reduce((total, item) => total + item.totalForecast, 0);
  const reported = items.reduce((total, item) => total + item.totalActualForecast, 0);
  const returns = items
    .map((item) => item.profitability)
    .filter((value): value is number => value !== null);
  const statuses = new Map<PortfolioItem['status'], number>();
  for (const item of items) statuses.set(item.status, (statuses.get(item.status) ?? 0) + 1);
  return {
    projects: items.length,
    budget,
    real,
    projected,
    reported,
    consumed: budget > 0 ? reported / budget : null,
    atRisk: items.filter((item) => item.profitability !== null && item.profitability < 0).length,
    overBudget: items.filter(
      (item) => item.totalBudget > 0 && item.totalActualForecast > item.totalBudget,
    ).length,
    averageReturn: returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
    withReturn: returns.length,
    variance: reported - budget,
    variancePercent: budget > 0 ? (reported - budget) / budget : null,
    byStatus: [...statuses].map(([status, count]) => ({ status, count })),
  };
}

/** The projects ordered by how much of their budget they have used, most first; those with no
 * budget are left out. */
export function mostConsumed(items: PortfolioItem[], limit: number): PortfolioItem[] {
  return items
    .filter((item) => item.totalBudget > 0)
    .sort((a, b) => b.totalActualForecast / b.totalBudget - a.totalActualForecast / a.totalBudget)
    .slice(0, limit);
}
