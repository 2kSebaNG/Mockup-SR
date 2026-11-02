import type { components } from '@/lib/abastecimiento/api/schema';
import { applyForecastEdits, editKey } from '@/lib/abastecimiento/projection-overlay';
import { variance } from '@/lib/abastecimiento/projection-grid';

type SummaryCell = components['schemas']['SummaryCell'];
type AccountDetail = components['schemas']['AccountDetail'];

const cell = (
  budget: number | null,
  actual: number | null,
  forecast: number | null,
): SummaryCell => ({ budget, actual, forecast, reported: actual ?? forecast });

const empty = cell(null, null, null);

function add(a: number | null, b: number | null): number | null {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

function sumCells(a: SummaryCell, b: SummaryCell): SummaryCell {
  return {
    budget: add(a.budget, b.budget),
    actual: add(a.actual, b.actual),
    forecast: add(a.forecast, b.forecast),
    reported: add(a.reported, b.reported),
  };
}

function node(
  id: string,
  byPeriod: Record<string, SummaryCell>,
  children: AccountDetail[] = [],
): AccountDetail {
  return {
    chartAccountId: id,
    code: id,
    name: id,
    parentAccountId: null,
    byPeriod,
    totals: Object.values(byPeriod).reduce(sumCells, empty),
    children,
  };
}

function rolled(id: string, children: AccountDetail[]): AccountDetail {
  const periods = new Set(children.flatMap((c) => Object.keys(c.byPeriod)));
  const byPeriod: Record<string, SummaryCell> = {};
  for (const p of periods) {
    byPeriod[p] = children.reduce((sum, c) => sumCells(sum, c.byPeriod[p] ?? empty), empty);
  }
  return node(id, byPeriod, children);
}

const OCT = '2026-10-01';
const NOV = '2026-11-01';

// root > group > leaf A (Oct 20, Nov 20), leaf B (Oct real 5, Nov 6 projected)
const leafA = node('a', { [OCT]: cell(20, null, 20), [NOV]: cell(20, null, 20) });
const leafB = node('b', { [OCT]: cell(6, 5, null), [NOV]: cell(6, null, 6) });
const group = rolled('g', [leafA, leafB]);
const root = rolled('root', [group]);
const tree = [root];

const find = (accounts: AccountDetail[], id: string): AccountDetail => {
  for (const account of accounts) {
    if (account.chartAccountId === id) return account;
    const inside = account.children.length ? find(account.children, id) : undefined;
    if (inside) return inside;
  }
  throw new Error(`no ${id}`);
};

describe('applyForecastEdits', () => {
  it('is the same tree when nothing was typed', () => {
    expect(applyForecastEdits(tree, new Map())).toBe(tree);
  });

  it('never changes the tree it was given', () => {
    const before = JSON.stringify(tree);
    applyForecastEdits(tree, new Map([[editKey('a', OCT), 99]]));
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('sets the cell itself, as reported and as projected', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('a', OCT), 30]]));
    expect(find(next, 'a').byPeriod[OCT]).toMatchObject({
      forecast: 30,
      reported: 30,
      actual: null,
    });
  });

  it('moves every group above it, month and total, by the same amount', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('a', OCT), 30]]));
    // Oct: 20 -> 30, so +10 on the group (25 -> 35) and on the root
    expect(find(next, 'g').byPeriod[OCT]!.reported).toBe(35);
    expect(find(next, 'g').byPeriod[OCT]!.forecast).toBe(30);
    expect(find(next, 'root').byPeriod[OCT]!.reported).toBe(35);
    // November is untouched
    expect(find(next, 'g').byPeriod[NOV]!.reported).toBe(26);
  });

  it('moves the totals, which are the sum of the months', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('a', OCT), 30]]));
    expect(find(next, 'a').totals.reported).toBe(50);
    expect(find(next, 'g').totals.reported).toBe(find(tree, 'g').totals.reported! + 10);
    expect(find(next, 'root').totals.forecast).toBe(find(tree, 'root').totals.forecast! + 10);
    expect(find(next, 'g').totals.actual).toBe(5);
  });

  it('moves the variation, which the grid derives from budget and reported', () => {
    const before = variance(find(tree, 'root').totals)!;
    const next = applyForecastEdits(tree, new Map([[editKey('a', OCT), 30]]));
    expect(variance(find(next, 'root').totals)).toBe(before + 10);
  });

  it('subtracts when a projection goes down', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('a', NOV), 5]]));
    expect(find(next, 'g').byPeriod[NOV]!.reported).toBe(11);
    expect(find(next, 'root').totals.reported).toBe(find(tree, 'root').totals.reported! - 15);
  });

  it('clears a cell back to nothing, and takes its amount out of the groups', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('a', NOV), null]]));
    expect(find(next, 'a').byPeriod[NOV]).toMatchObject({ forecast: null, reported: null });
    expect(find(next, 'g').byPeriod[NOV]!.reported).toBe(6);
    expect(find(next, 'a').totals.forecast).toBe(20);
  });

  it('leaves a cell without a projection blank until something is typed, then fills it', () => {
    const blank = node('c', { [OCT]: cell(10, null, null) });
    const parent = rolled('p', [blank]);
    expect(parent.byPeriod[OCT]!.reported).toBeNull();
    const next = applyForecastEdits([parent], new Map([[editKey('c', OCT), 7]]));
    expect(find(next, 'c').byPeriod[OCT]!.reported).toBe(7);
    expect(find(next, 'p').byPeriod[OCT]!.reported).toBe(7);
    expect(find(next, 'p').totals.reported).toBe(7);
  });

  it('applies several edits at once', () => {
    const next = applyForecastEdits(
      tree,
      new Map([
        [editKey('a', OCT), 30],
        [editKey('b', NOV), 10],
      ]),
    );
    expect(find(next, 'g').byPeriod[OCT]!.reported).toBe(35);
    expect(find(next, 'g').byPeriod[NOV]!.reported).toBe(30);
    expect(find(next, 'root').totals.reported).toBe(find(tree, 'root').totals.reported! + 10 + 4);
  });

  it('changes nothing on a month that already has real: the real wins', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('b', OCT), 99]]));
    expect(find(next, 'b').byPeriod[OCT]).toMatchObject({ actual: 5, reported: 5 });
    expect(find(next, 'g').byPeriod[OCT]!.reported).toBe(25);
  });

  it('ignores an account the tree does not have', () => {
    const next = applyForecastEdits(tree, new Map([[editKey('nope', OCT), 1]]));
    expect(find(next, 'root').totals.reported).toBe(find(tree, 'root').totals.reported);
  });

  it('shows at once what is typed in a month the account has no figure in at all', () => {
    // The report has no cell for an account in a month where it has no budget, real or
    // projection: the typed amount must still show, in the cell, its groups and the totals.
    const bare = node('c', { [OCT]: cell(10, null, 3) });
    const parent = rolled('p', [bare]);
    const next = applyForecastEdits([parent], new Map([[editKey('c', NOV), 12]]));
    expect(find(next, 'c').byPeriod[NOV]).toEqual({
      budget: null,
      actual: null,
      forecast: 12,
      reported: 12,
    });
    expect(find(next, 'p').byPeriod[NOV]).toMatchObject({ forecast: 12, reported: 12 });
    expect(find(next, 'p').totals.reported).toBe(3 + 12);
    expect(find(next, 'c').totals.reported).toBe(3 + 12);
  });

  it('clearing a month that has no cell leaves nothing behind', () => {
    const bare = node('c', { [OCT]: cell(10, null, 3) });
    const parent = rolled('p', [bare]);
    const next = applyForecastEdits([parent], new Map([[editKey('c', NOV), null]]));
    expect(find(next, 'p').totals.reported).toBe(3);
  });

  it('can edit a group itself, for what sits directly on it', () => {
    const own = rolled('g2', [leafA]);
    own.byPeriod[OCT] = sumCells(own.byPeriod[OCT]!, cell(null, null, 4));
    const next = applyForecastEdits([own], new Map([[editKey('g2', OCT), 9]]));
    expect(find(next, 'g2').byPeriod[OCT]!.forecast).toBe(9);
    // its child is untouched
    expect(find(next, 'a').byPeriod[OCT]!.forecast).toBe(20);
  });
});
