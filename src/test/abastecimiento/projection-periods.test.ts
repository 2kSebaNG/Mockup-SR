import type { components } from '@/lib/abastecimiento/api/schema';
import { changeOrigins, originsIn, subtreeIds } from '@/lib/abastecimiento/change-origins';
import {
  accountIndex,
  deltaVsOriginal,
  ownCell,
  rowCell,
  visibleRows,
} from '@/lib/abastecimiento/projection-grid';
import { isCellEditable } from '@/lib/abastecimiento/projection-edit';
import {
  buildPeriodColumns,
  groupKeyOf,
  isGroupKey,
  monthsOfKey,
  parseGrouping,
  periodLabel,
} from '@/lib/abastecimiento/projection-periods';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];

const m = (n: number, year = 2026) => `${year}-${String(n).padStart(2, '0')}-01`;

const cell = (
  budget: number | null,
  actual: number | null,
  forecast: number | null,
): SummaryCell => ({ budget, actual, forecast, reported: actual ?? forecast });

function leaf(id: string, byPeriod: Record<string, SummaryCell>): AccountDetail {
  return {
    chartAccountId: id,
    code: id,
    name: id,
    parentAccountId: 'g',
    byPeriod,
    totals: sumOf(Object.values(byPeriod)),
    children: [],
  };
}

function sumOf(cells: SummaryCell[]): SummaryCell {
  const add = (pick: (c: SummaryCell) => number | null) => {
    const values = cells.map(pick).filter((v): v is number => v !== null);
    return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
  };
  return {
    budget: add((c) => c.budget),
    actual: add((c) => c.actual),
    forecast: add((c) => c.forecast),
    reported: add((c) => c.reported),
  };
}

function group(children: AccountDetail[]): AccountDetail {
  const periods = new Set(children.flatMap((c) => Object.keys(c.byPeriod)));
  const byPeriod: Record<string, SummaryCell> = {};
  for (const p of periods) byPeriod[p] = sumOf(children.map((c) => c.byPeriod[p]).filter((cell): cell is SummaryCell => Boolean(cell)));
  return {
    chartAccountId: 'g',
    code: 'g',
    name: 'g',
    parentAccountId: null,
    byPeriod,
    totals: sumOf(Object.values(byPeriod)),
    children,
  };
}

describe('group keys', () => {
  it('name the quarter, semester or year a month falls in', () => {
    expect(groupKeyOf(m(1), 'quarter')).toBe('g:Q:2026-1');
    expect(groupKeyOf(m(3), 'quarter')).toBe('g:Q:2026-1');
    expect(groupKeyOf(m(4), 'quarter')).toBe('g:Q:2026-2');
    expect(groupKeyOf(m(12), 'quarter')).toBe('g:Q:2026-4');
    expect(groupKeyOf(m(6), 'semester')).toBe('g:S:2026-1');
    expect(groupKeyOf(m(7), 'semester')).toBe('g:S:2026-2');
    expect(groupKeyOf(m(7), 'year')).toBe('g:Y:2026');
    expect(groupKeyOf(m(7), 'month')).toBe(m(7));
  });

  it('say which months they cover, and a plain month is itself', () => {
    expect(monthsOfKey('g:Q:2026-2')).toEqual([m(4), m(5), m(6)]);
    expect(monthsOfKey('g:S:2026-2')).toEqual([m(7), m(8), m(9), m(10), m(11), m(12)]);
    expect(monthsOfKey('g:Y:2027')).toHaveLength(12);
    expect(monthsOfKey('g:Y:2027')[0]).toBe(m(1, 2027));
    expect(monthsOfKey(m(5))).toEqual([m(5)]);
  });

  it('are told apart from months and labelled', () => {
    expect(isGroupKey('g:Q:2026-1')).toBe(true);
    expect(isGroupKey(m(1))).toBe(false);
    expect(isGroupKey('total')).toBe(false);
    expect(periodLabel('g:Q:2026-3')).toBe('T3 2026');
    expect(periodLabel('g:S:2026-1')).toBe('S1 2026');
    expect(periodLabel('g:Y:2026')).toBe('2026');
    expect(periodLabel(m(2))).toBe('feb 2026');
  });

  it('parse a stored grouping, falling back to month', () => {
    expect(parseGrouping('quarter')).toBe('quarter');
    expect(parseGrouping('nope')).toBe('month');
    expect(parseGrouping(null)).toBe('month');
  });
});

describe('buildPeriodColumns', () => {
  const periods = [m(1), m(2), m(3), m(4), m(5)];

  it('is one column per month for "mes"', () => {
    expect(buildPeriodColumns(periods, 'month').map((c) => c.key)).toEqual(periods);
  });

  it('is one column per quarter, with the months it really has', () => {
    const columns = buildPeriodColumns(periods, 'quarter');
    expect(columns.map((c) => [c.key, c.label, c.kind])).toEqual([
      ['g:Q:2026-1', 'T1 2026', 'group'],
      ['g:Q:2026-2', 'T2 2026', 'group'],
    ]);
    expect(columns[1]!.months).toEqual([m(4), m(5)]);
  });

  it('follows an opened group with its months, which remember where they belong', () => {
    const columns = buildPeriodColumns(periods, 'quarter', new Set(['g:Q:2026-1']));
    expect(columns.map((c) => c.key)).toEqual(['g:Q:2026-1', m(1), m(2), m(3), 'g:Q:2026-2']);
    expect(columns[1]).toMatchObject({ kind: 'month', within: 'g:Q:2026-1' });
  });

  it('keeps years apart', () => {
    const columns = buildPeriodColumns([m(11), m(12), m(1, 2027)], 'year');
    expect(columns.map((c) => c.key)).toEqual(['g:Y:2026', 'g:Y:2027']);
  });
});

describe('a group of months read from an account', () => {
  const a = leaf('a', {
    [m(1)]: cell(100, 90, null),
    [m(2)]: cell(100, null, 110),
    [m(3)]: cell(100, null, 120),
    [m(4)]: cell(100, null, 130),
  });
  const g = group([a, leaf('b', { [m(1)]: cell(10, null, 7) })]);
  const rows = visibleRows([g], new Set(), [m(1), m(2), m(3), m(4)]);
  const row = (id: string) => rows.find((r) => r.key === id)!;

  it('is the sum of its months, figure by figure', () => {
    expect(rowCell(row('a'), 'g:Q:2026-1')).toEqual({
      budget: 300,
      actual: 90,
      forecast: 230,
      reported: 320,
    });
    expect(rowCell(row('a'), 'g:Q:2026-2')).toMatchObject({ budget: 100, reported: 130 });
  });

  it('is empty for months the account has nothing in', () => {
    expect(rowCell(row('a'), 'g:Q:2026-3')).toEqual({
      budget: null,
      actual: null,
      forecast: null,
      reported: null,
    });
  });

  it('rolls up a group of accounts as a sum too', () => {
    expect(rowCell(row('g'), 'g:S:2026-1').reported).toBe(320 + 130 + 7);
    expect(ownCell(g, 'g:Q:2026-1').reported).toBeNull();
  });

  it('cannot be typed in', () => {
    expect(isCellEditable(row('a'), 'g:Q:2026-1', 'forecast')).toBe(false);
    expect(isCellEditable(row('a'), m(3), 'forecast')).toBe(true);
  });

  it('works with the change against the original', () => {
    const changed = group([
      leaf('a', {
        [m(1)]: cell(100, 90, null),
        [m(2)]: cell(100, null, 160),
        [m(3)]: cell(100, null, 120),
        [m(4)]: cell(100, null, 130),
      }),
      leaf('b', { [m(1)]: cell(10, null, 7) }),
    ]);
    const changedRows = visibleRows([changed], new Set(), [m(1), m(2), m(3), m(4)]);
    const index = accountIndex([g]);
    expect(deltaVsOriginal(changedRows[1]!, 'g:Q:2026-1', index)).toBe(50);
    expect(deltaVsOriginal(changedRows[1]!, 'g:Q:2026-2', index)).toBeNull();
    expect(deltaVsOriginal(changedRows[0]!, 'g:Y:2026', index)).toBe(50);
  });
});

describe('the cells a change started from', () => {
  const periods = [m(1), m(2), m(3)];
  const original = group([
    leaf('a', { [m(1)]: cell(100, null, 100), [m(2)]: cell(100, null, 100) }),
    leaf('b', { [m(1)]: cell(50, null, 50), [m(3)]: cell(50, null, 50) }),
  ]);
  const edited = group([
    leaf('a', { [m(1)]: cell(100, null, 150), [m(2)]: cell(100, null, 100) }),
    leaf('b', { [m(1)]: cell(50, null, 50), [m(3)]: cell(50, null, 20) }),
  ]);
  const baseline = accountIndex([original]);

  it('are the changed cells, not the groups and totals that moved with them', () => {
    const origins = changeOrigins([edited], baseline, periods);
    expect(origins.map((o) => [o.chartAccountId, o.period, o.delta])).toEqual([
      ['a', m(1), 50],
      ['b', m(3), -30],
    ]);
    expect(origins[0]!.accountName).toBe('a');
  });

  it('are nothing when nothing changed', () => {
    expect(changeOrigins([original], baseline, periods)).toEqual([]);
  });

  it('find a change made on the group itself, apart from its children', () => {
    const withOwn = group([
      leaf('a', { [m(1)]: cell(100, null, 100) }),
      leaf('b', { [m(1)]: cell(50, null, 50) }),
    ]);
    withOwn.byPeriod[m(1)] = { ...withOwn.byPeriod[m(1)]!, reported: 175, forecast: 175 };
    const origins = changeOrigins(
      [withOwn],
      accountIndex([
        group([
          leaf('a', { [m(1)]: cell(100, null, 100) }),
          leaf('b', { [m(1)]: cell(50, null, 50) }),
        ]),
      ]),
      [m(1)],
    );
    expect(origins).toEqual([expect.objectContaining({ chartAccountId: 'g', delta: 25 })]);
  });

  it('are picked out for the accounts and months a figure covers', () => {
    const origins = changeOrigins([edited], baseline, periods);
    const all = subtreeIds(edited);
    expect(originsIn(origins, all, [m(1), m(2), m(3)])).toHaveLength(2);
    expect(originsIn(origins, all, [m(1)])).toHaveLength(1);
    expect(originsIn(origins, new Set(['b']), [m(1)])).toHaveLength(0);
    expect(originsIn(origins, new Set(['b']), [m(3)])).toHaveLength(1);
  });
});
