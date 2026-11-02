import type { components } from './api/schema';
import { isGroupKey, monthsOfKey } from './projection-periods';

type SummaryCell = components['schemas']['SummaryCell'];
type AccountDetail = components['schemas']['AccountDetail'];

/** What the month columns of the projection grid show. "reported" is the IC way: the real
 * where there is one, the projection where there is not yet. */
export type GridView = 'reported' | 'budget' | 'actual' | 'forecast' | 'variance';

export const GRID_VIEWS: { key: GridView; label: string }[] = [
  { key: 'reported', label: 'Real + Proyectado' },
  { key: 'budget', label: 'Presupuesto' },
  { key: 'actual', label: 'Real' },
  { key: 'forecast', label: 'Proyectado' },
  { key: 'variance', label: 'Variación' },
];

/** The view a URL or a select names; anything unknown is the IC view. */
export function parseGridView(value: string | null | undefined): GridView {
  return GRID_VIEWS.find((view) => view.key === value)?.key ?? 'reported';
}

export function emptyCell(): SummaryCell {
  return { budget: null, actual: null, forecast: null, reported: null };
}

/** What was reported minus what was budgeted. `null` when either is missing: a blank is
 * shown blank, never as a made-up zero (section 2.3c). Whether a positive number is good
 * or bad depends on whether the account is an income or a cost, which the chart does not
 * say, so the grid shows the sign without judging it. */
export function variance(cell: SummaryCell): number | null {
  if (cell.budget === null || cell.reported === null) return null;
  return cell.reported - cell.budget;
}

export function cellValue(cell: SummaryCell, view: GridView): number | null {
  switch (view) {
    case 'budget':
      return cell.budget;
    case 'actual':
      return cell.actual;
    case 'forecast':
      return cell.forecast;
    case 'variance':
      return variance(cell);
    default:
      return cell.reported;
  }
}

/** What a reported figure is made of, so the grid can tell real from projected. A leaf's
 * reported is its real when it has one, else its projection. A group's is the sum of its
 * children's reported, so it can be both: some children already real, others still
 * projected ("mixed"). */
export function reportedKind(cell: SummaryCell): 'actual' | 'forecast' | 'mixed' | null {
  if (cell.reported === null) return null;
  if (cell.actual === null) return 'forecast';
  return Math.abs(cell.reported - cell.actual) < 0.5 ? 'actual' : 'mixed';
}

/** Whether a reported figure includes any projection (and so is an estimate). */
export function includesProjection(cell: SummaryCell): boolean {
  const kind = reportedKind(cell);
  return kind === 'forecast' || kind === 'mixed';
}

export interface GridRowModel {
  /** Stable key for React and for collapse state. */
  key: string;
  account: AccountDetail;
  depth: number;
  expandable: boolean;
  collapsed: boolean;
  /** A synthetic row holding what was posted straight to a group, outside its children. */
  own?: boolean;
}

/** `null`-aware: nothing anywhere stays `null`, a lone value counts the rest as 0 — the
 * same rule the API uses to roll a subtree up. */
function subtract(a: number | null, b: number | null): number | null {
  if (a === null) return null;
  return a - (b ?? 0);
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0);
}

/** Below this many pesos a difference is rounding, not data. */
const MATERIAL = 0.5;

/** A figure that rounds to nothing is shown blank rather than as a made-up zero. */
function blankIfNegligible(value: number | null): number | null {
  return value === null || Math.abs(value) < MATERIAL ? null : value;
}

/** The figures of an account for a month, for the whole span ('total'), or for a group of
 * months (a quarter, a semester, a year: their sum). */
export function accountCell(account: AccountDetail, period: string | 'total'): SummaryCell {
  if (period === 'total') return account.totals;
  if (isGroupKey(period)) {
    const cells = monthsOfKey(period).map((month) => account.byPeriod[month] ?? emptyCell());
    return {
      budget: sum(cells.map((c) => c.budget)),
      actual: sum(cells.map((c) => c.actual)),
      forecast: sum(cells.map((c) => c.forecast)),
      reported: sum(cells.map((c) => c.reported)),
    };
  }
  return account.byPeriod[period] ?? emptyCell();
}

/** A group's own figures for one period: its cell minus what its children add up to.
 * The API rolls a group up as "own + children", so this is what is left once the children
 * are taken out. */
export function ownCell(account: AccountDetail, period: string | 'total'): SummaryCell {
  const of = (node: AccountDetail) => accountCell(node, period);
  const group = of(account);
  const children = account.children.map(of);
  return {
    budget: blankIfNegligible(subtract(group.budget, sum(children.map((c) => c.budget)))),
    actual: blankIfNegligible(subtract(group.actual, sum(children.map((c) => c.actual)))),
    forecast: blankIfNegligible(subtract(group.forecast, sum(children.map((c) => c.forecast)))),
    reported: blankIfNegligible(subtract(group.reported, sum(children.map((c) => c.reported)))),
  };
}

/** Whether anything was posted straight to this group rather than to its children. */
export function hasOwnValues(account: AccountDetail, periods: string[]): boolean {
  if (account.children.length === 0) return false;
  return ['total', ...periods].some((period) => {
    const own = ownCell(account, period);
    return [own.budget, own.actual, own.forecast, own.reported].some((value) => value !== null);
  });
}

/** The rows to draw, top to bottom: the tree depth-first, skipping what is collapsed, and
 * after each group's children a row for what was posted to the group itself, if any. */
export function visibleRows(
  accounts: AccountDetail[],
  collapsed: ReadonlySet<string>,
  periods: string[] = [],
): GridRowModel[] {
  const rows: GridRowModel[] = [];
  const walk = (account: AccountDetail, depth: number) => {
    const expandable = account.children.length > 0;
    const isCollapsed = collapsed.has(account.chartAccountId);
    rows.push({
      key: account.chartAccountId,
      account,
      depth,
      expandable,
      collapsed: isCollapsed,
    });
    if (!expandable || isCollapsed) return;
    for (const child of account.children) walk(child, depth + 1);
    if (hasOwnValues(account, periods)) {
      rows.push({
        key: `${account.chartAccountId}:own`,
        account,
        depth: depth + 1,
        expandable: false,
        collapsed: false,
        own: true,
      });
    }
  };
  for (const root of accounts) walk(root, 0);
  return rows;
}

/** Every account that has children — what "contraer todo" collapses. */
export function groupIds(accounts: AccountDetail[]): string[] {
  const ids: string[] = [];
  const walk = (account: AccountDetail) => {
    if (account.children.length === 0) return;
    ids.push(account.chartAccountId);
    account.children.forEach(walk);
  };
  accounts.forEach(walk);
  return ids;
}

/** The figures a row shows for a period (or the whole span), its own slice for the
 * synthetic "directo en el grupo" row. */
export function rowCell(row: GridRowModel, period: string | 'total'): SummaryCell {
  if (row.own) return ownCell(row.account, period);
  return accountCell(row.account, period);
}

/** A tooltip with the four figures of a cell side by side, so Presupuesto, Real and
 * Proyectado can be compared without leaving the grid. */
export function cellSummary(
  cell: SummaryCell,
  format: (value: number | null | undefined) => string,
): string {
  return [
    `Presupuesto: ${format(cell.budget)}`,
    `Real: ${format(cell.actual)}`,
    `Proyectado: ${format(cell.forecast)}`,
    `Variación: ${format(variance(cell))}`,
  ].join('\n');
}

/** How much a scenario moves one figure: the reported amount of the row in the scenario
 * minus the one in the original (the project's own projection), for a month or the whole
 * span. `null` when they agree — a row the scenario did not touch is shown blank, not as a
 * made-up zero. An account the original does not have counts as nothing there. */
export function deltaVsOriginal(
  row: GridRowModel,
  period: string | 'total',
  original: ReadonlyMap<string, AccountDetail>,
): number | null {
  const now = rowCell(row, period).reported;
  const before = originalCellOf(row, period, original).reported;
  if (now === null && before === null) return null;
  return blankIfNegligible((now ?? 0) - (before ?? 0));
}

/** The same cell in the original: what a row holds for a month (or in total) there, empty if
 * the original has nothing for that account. */
export function originalCellOf(
  row: GridRowModel,
  period: string | 'total',
  original: ReadonlyMap<string, AccountDetail>,
): SummaryCell {
  const counterpart = original.get(row.account.chartAccountId);
  return counterpart ? rowCell({ ...row, account: counterpart }, period) : emptyCell();
}

/** Every account of a tree by id, for looking up its counterpart in another version. */
export function accountIndex(accounts: AccountDetail[]): Map<string, AccountDetail> {
  const index = new Map<string, AccountDetail>();
  const walk = (account: AccountDetail) => {
    index.set(account.chartAccountId, account);
    account.children.forEach(walk);
  };
  accounts.forEach(walk);
  return index;
}

/** What share of a total a figure is, as a ratio (0.25 is 25%). `null` when either is missing
 * or the total is nothing: a share of zero is not 0%, it is not defined. */
export function shareOfParent(part: number | null, total: number | null): number | null {
  if (part === null || total === null || total === 0) return null;
  return part / total;
}
