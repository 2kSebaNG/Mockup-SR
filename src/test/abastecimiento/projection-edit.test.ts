import type { components } from '@/lib/abastecimiento/api/schema';
import { cellKey, isCellEditable, nextEditableCell } from '@/lib/abastecimiento/projection-edit';
import { visibleRows } from '@/lib/abastecimiento/projection-grid';

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

function account(
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

/** A group rolled up like the API does: its own cells plus its children's. */
function group(
  id: string,
  children: AccountDetail[],
  own: Record<string, SummaryCell> = {},
): AccountDetail {
  const periods = new Set<string>([
    ...Object.keys(own),
    ...children.flatMap((child) => Object.keys(child.byPeriod)),
  ]);
  const byPeriod: Record<string, SummaryCell> = {};
  for (const period of periods) {
    byPeriod[period] = children.reduce(
      (rolled, child) => sumCells(rolled, child.byPeriod[period] ?? empty),
      own[period] ?? empty,
    );
  }
  return account(id, byPeriod, children);
}

describe('which cells take a projection', () => {
  const periods = ['2026-01-01', '2026-02-01', '2026-03-01'];
  // January is real, February and March are still open.
  const real = account('real', {
    '2026-01-01': cell(10, 8, null),
    '2026-02-01': cell(10, null, 12),
    '2026-03-01': cell(10, null, null),
  });
  const open = account('open', {
    '2026-01-01': cell(10, null, null),
    '2026-02-01': cell(10, null, null),
    '2026-03-01': cell(10, 4, null),
  });
  const grp = group('g', [real, open]);
  const rows = visibleRows([grp], new Set(), periods);
  const rowOf = (key: string) => rows.find((r) => r.key === key)!;

  it('is a leaf, in a month without real, while the months show the projection', () => {
    expect(isCellEditable(rowOf('real'), '2026-02-01', 'reported')).toBe(true);
    expect(isCellEditable(rowOf('real'), '2026-03-01', 'forecast')).toBe(true);
  });

  it('is never a month that already has real: the real comes from the purchase orders', () => {
    expect(isCellEditable(rowOf('real'), '2026-01-01', 'reported')).toBe(false);
    expect(isCellEditable(rowOf('open'), '2026-03-01', 'reported')).toBe(false);
  });

  it('is never a group, which is the sum of its children', () => {
    expect(isCellEditable(rowOf('g'), '2026-02-01', 'reported')).toBe(false);
  });

  it('is not editable in a view that does not show the projection', () => {
    for (const view of ['budget', 'actual', 'variance'] as const) {
      expect(isCellEditable(rowOf('real'), '2026-02-01', view)).toBe(false);
    }
  });

  it('lets a projection sitting on a group be corrected or cleared, but not added to', () => {
    const withOwn = group('g', [real], { '2026-02-01': cell(null, null, 5) });
    const own = visibleRows([withOwn], new Set(), periods).find((r) => r.own)!;
    expect(isCellEditable(own, '2026-02-01', 'reported')).toBe(true);
    expect(isCellEditable(own, '2026-03-01', 'reported')).toBe(false);
  });
});

describe('moving between editable cells', () => {
  const periods = ['2026-01-01', '2026-02-01', '2026-03-01'];
  const a = account('a', {
    '2026-01-01': cell(1, 5, null), // real: not editable
    '2026-02-01': cell(1, null, null),
    '2026-03-01': cell(1, null, null),
  });
  const b = account('b', {
    '2026-01-01': cell(1, null, null),
    '2026-02-01': cell(1, 9, null), // real: not editable
    '2026-03-01': cell(1, null, null),
  });
  const c = account('c', {
    '2026-01-01': cell(1, null, null),
    '2026-02-01': cell(1, null, null),
    '2026-03-01': cell(1, null, null),
  });
  const rows = visibleRows([group('g', [a, b, c])], new Set(), periods);
  const go = (rowKey: string, period: string, move: Parameters<typeof nextEditableCell>[4]) =>
    nextEditableCell(rows, periods, 'reported', { rowKey, period }, move);

  it('goes down the same month, skipping what has real', () => {
    expect(go('a', '2026-02-01', 'down')).toEqual({ rowKey: 'c', period: '2026-02-01' });
    expect(go('a', '2026-03-01', 'down')).toEqual({ rowKey: 'b', period: '2026-03-01' });
  });

  it('goes up the same month', () => {
    expect(go('c', '2026-01-01', 'up')).toEqual({ rowKey: 'b', period: '2026-01-01' });
  });

  it('goes right along the account, skipping what has real', () => {
    expect(go('b', '2026-01-01', 'right')).toEqual({ rowKey: 'b', period: '2026-03-01' });
    expect(go('a', '2026-02-01', 'right')).toEqual({ rowKey: 'a', period: '2026-03-01' });
  });

  it('goes left along the account', () => {
    expect(go('c', '2026-03-01', 'left')).toEqual({ rowKey: 'c', period: '2026-02-01' });
  });

  it('is nowhere at the edge, and never lands on a group', () => {
    expect(go('c', '2026-02-01', 'down')).toBeNull();
    expect(go('a', '2026-03-01', 'right')).toBeNull();
    expect(go('a', '2026-02-01', 'up')).toBeNull();
  });

  it('is nowhere for a cell it does not know', () => {
    expect(go('nope', '2026-02-01', 'down')).toBeNull();
    expect(go('a', '2030-01-01', 'right')).toBeNull();
  });

  it('skips the cells that are made of concepts, which are not typed in directly', () => {
    const blocked = (row: { key: string }, period: string) =>
      row.key === 'c' && period === '2026-02-01';
    const goBlocked = (rowKey: string, period: string, move: 'down' | 'right') =>
      nextEditableCell(rows, periods, 'reported', { rowKey, period }, move, blocked);
    expect(goBlocked('a', '2026-02-01', 'down')).toBeNull();
    expect(goBlocked('c', '2026-01-01', 'right')).toEqual({ rowKey: 'c', period: '2026-03-01' });
  });

  it('keys a cell by row and month', () => {
    expect(cellKey(rows[1]!, '2026-02-01')).toBe('a|2026-02-01');
  });
});
