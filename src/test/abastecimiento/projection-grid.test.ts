import type { components } from '@/lib/abastecimiento/api/schema';
import {
  accountIndex,
  cellSummary,
  cellValue,
  deltaVsOriginal,
  groupIds,
  hasOwnValues,
  originalCellOf,
  includesProjection,
  ownCell,
  parseGridView,
  shareOfParent,
  reportedKind,
  variance,
  visibleRows,
} from '@/lib/abastecimiento/projection-grid';

type SummaryCell = components['schemas']['SummaryCell'];
type AccountDetail = components['schemas']['AccountDetail'];

const cell = (
  budget: number | null,
  actual: number | null,
  forecast: number | null,
): SummaryCell => ({ budget, actual, forecast, reported: actual ?? forecast });

const empty = cell(null, null, null);

function account(
  id: string,
  byPeriod: Record<string, SummaryCell>,
  children: AccountDetail[] = [],
): AccountDetail {
  const totals = Object.values(byPeriod).reduce<SummaryCell>(
    (sum, c) => ({
      budget: add(sum.budget, c.budget),
      actual: add(sum.actual, c.actual),
      forecast: add(sum.forecast, c.forecast),
      reported: add(sum.reported, c.reported),
    }),
    empty,
  );
  return {
    chartAccountId: id,
    code: id,
    name: id,
    parentAccountId: null,
    byPeriod,
    totals,
    children,
  };
}

function add(a: number | null, b: number | null): number | null {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

/** A group rolled up like the API does: its own cells plus its children's, field by field,
 * with the reported of a group being the sum of its children's reported. */
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
    let rolled = own[period] ?? empty;
    for (const child of children) {
      const c = child.byPeriod[period] ?? empty;
      rolled = {
        budget: add(rolled.budget, c.budget),
        actual: add(rolled.actual, c.actual),
        forecast: add(rolled.forecast, c.forecast),
        reported: add(rolled.reported, c.reported),
      };
    }
    byPeriod[period] = rolled;
  }
  return account(id, byPeriod, children);
}

describe('parseGridView', () => {
  it('reads a known view and falls back to the IC one', () => {
    expect(parseGridView('budget')).toBe('budget');
    expect(parseGridView('variance')).toBe('variance');
    expect(parseGridView('nope')).toBe('reported');
    expect(parseGridView(null)).toBe('reported');
  });
});

describe('variance', () => {
  it('is what was reported minus what was budgeted', () => {
    expect(variance(cell(100, 130, null))).toBe(30);
    expect(variance(cell(100, null, 80))).toBe(-20);
  });

  it('is blank, never a made-up zero, when either side is missing', () => {
    expect(variance(cell(null, 50, null))).toBeNull();
    expect(variance(cell(100, null, null))).toBeNull();
  });
});

describe('cellValue', () => {
  const c = cell(100, 70, 90);
  it('picks the figure of each view', () => {
    expect(cellValue(c, 'budget')).toBe(100);
    expect(cellValue(c, 'actual')).toBe(70);
    expect(cellValue(c, 'forecast')).toBe(90);
    expect(cellValue(c, 'reported')).toBe(70);
    expect(cellValue(c, 'variance')).toBe(-30);
  });

  it('shows the projection in the IC view when there is no real yet', () => {
    expect(cellValue(cell(100, null, 90), 'reported')).toBe(90);
  });
});

describe('reportedKind', () => {
  it('says whether a figure is real, a projection, or nothing', () => {
    expect(reportedKind(cell(1, 5, 9))).toBe('actual');
    expect(reportedKind(cell(1, null, 9))).toBe('forecast');
    expect(reportedKind(cell(1, null, null))).toBeNull();
  });

  it('treats a real of zero as real', () => {
    expect(reportedKind(cell(1, 0, 9))).toBe('actual');
  });

  it('calls a group mixed when some children are real and others still projected', () => {
    const real = account('r', { '2026-01-01': cell(10, 8, null) });
    const projected = account('p', { '2026-01-01': cell(20, null, 25) });
    const rolled = group('g', [real, projected]).byPeriod['2026-01-01'];
    expect(rolled!.reported).toBe(33);
    expect(reportedKind(rolled!)).toBe('mixed');
    expect(includesProjection(rolled!)).toBe(true);
  });

  it('keeps a group real when every child is real', () => {
    const a = account('a', { '2026-01-01': cell(10, 8, null) });
    const b = account('b', { '2026-01-01': cell(20, 19, null) });
    expect(reportedKind(group('g', [a, b]).byPeriod['2026-01-01']!)).toBe('actual');
    expect(includesProjection(group('g', [a, b]).byPeriod['2026-01-01']!)).toBe(false);
  });
});

describe('visibleRows and groupIds', () => {
  const leafA = account('a', { '2026-01-01': cell(10, 8, null) });
  const leafB = account('b', { '2026-01-01': cell(20, null, 25) });
  const grp = group('g', [leafA, leafB]);
  const lone = account('x', { '2026-01-01': cell(5, 5, null) });
  const periods = ['2026-01-01'];

  it('walks the tree depth first with each row at its depth', () => {
    const rows = visibleRows([grp, lone], new Set(), periods);
    expect(rows.map((r) => [r.key, r.depth])).toEqual([
      ['g', 0],
      ['a', 1],
      ['b', 1],
      ['x', 0],
    ]);
    expect(rows[0]!.expandable).toBe(true);
    expect(rows[3]!.expandable).toBe(false);
  });

  it('skips the children of a collapsed group', () => {
    const rows = visibleRows([grp, lone], new Set(['g']), periods);
    expect(rows.map((r) => r.key)).toEqual(['g', 'x']);
    expect(rows[0]!.collapsed).toBe(true);
  });

  it('lists every account that has children', () => {
    expect(groupIds([grp, lone])).toEqual(['g']);
  });
});

describe('what was posted straight to a group', () => {
  const periods = ['2026-01-01', '2026-02-01'];
  const leaf = account('leaf', {
    '2026-01-01': cell(10, 8, null),
    '2026-02-01': cell(10, null, 12),
  });

  it('is nothing when a group is just its children added up', () => {
    expect(hasOwnValues(group('g', [leaf]), periods)).toBe(false);
  });

  it('shows up as its own row, with the figures that are left once the children are out', () => {
    // 5 projected straight on the group in February, on top of the leaf's 12
    const withOwn = group('g', [leaf], { '2026-02-01': cell(null, null, 5) });
    expect(hasOwnValues(withOwn, periods)).toBe(true);
    expect(ownCell(withOwn, '2026-02-01').forecast).toBe(5);
    expect(ownCell(withOwn, '2026-01-01').forecast).toBeNull();

    const rows = visibleRows([withOwn], new Set(), periods);
    expect(rows.map((r) => [r.key, r.own === true])).toEqual([
      ['g', false],
      ['leaf', false],
      ['g:own', true],
    ]);
  });

  it('leaves a figure blank when nothing was posted to the group itself', () => {
    const withOwn = group('g', [leaf], { '2026-02-01': cell(null, null, 5) });
    const own = ownCell(withOwn, '2026-01-01');
    expect(own).toEqual({ budget: null, actual: null, forecast: null, reported: null });
    expect(ownCell(withOwn, '2026-02-01').budget).toBeNull();
  });

  it('a leaf never has one', () => {
    expect(hasOwnValues(leaf, periods)).toBe(false);
  });

  it('ignores rounding noise below half a peso', () => {
    const noisy = group('g', [leaf], { '2026-01-01': cell(0.2, null, null) });
    expect(hasOwnValues(noisy, periods)).toBe(false);
  });
});

describe('cellSummary', () => {
  it('puts the four figures side by side', () => {
    const text = cellSummary(cell(100, 70, 90), (v) => (v == null ? '—' : String(v)));
    expect(text).toBe('Presupuesto: 100\nReal: 70\nProyectado: 90\nVariación: -30');
  });
});

describe('the change a scenario makes against the original', () => {
  const jan = '2026-01-01';
  const feb = '2026-02-01';
  const original = group('g', [
    account('l1', { [jan]: cell(100, null, 100), [feb]: cell(100, null, 100) }),
    account('l2', { [jan]: cell(50, null, 50) }),
  ]);
  const scenario = group('g', [
    account('l1', { [jan]: cell(100, null, 150), [feb]: cell(100, null, 100) }),
    account('l2', { [jan]: cell(50, null, 50) }),
  ]);
  const index = accountIndex([original]);
  const rows = visibleRows([scenario], new Set(), [jan, feb]);
  const rowOf = (id: string) => rows.find((row) => row.key === id)!;

  it('is the scenario figure minus the original one, rolled up into the groups', () => {
    expect(deltaVsOriginal(rowOf('l1'), jan, index)).toBe(50);
    expect(deltaVsOriginal(rowOf('g'), jan, index)).toBe(50);
    expect(deltaVsOriginal(rowOf('l1'), 'total', index)).toBe(50);
    expect(deltaVsOriginal(rowOf('g'), 'total', index)).toBe(50);
  });

  it('is blank where the scenario did not touch anything', () => {
    expect(deltaVsOriginal(rowOf('l2'), jan, index)).toBeNull();
    expect(deltaVsOriginal(rowOf('l1'), feb, index)).toBeNull();
    expect(deltaVsOriginal(rowOf('l2'), feb, index)).toBeNull();
  });

  it('is negative when the scenario lowers a figure', () => {
    const lower = group('g', [account('l1', { [jan]: cell(100, null, 40) })]);
    const lowerRows = visibleRows([lower], new Set(), [jan]);
    expect(deltaVsOriginal(lowerRows[1]!, jan, index)).toBe(-60);
  });

  it('counts an account the original does not have as new', () => {
    expect(deltaVsOriginal(rowOf('l1'), jan, new Map())).toBe(150);
  });

  it('reads the same cell of the original, empty where the original has nothing', () => {
    expect(originalCellOf(rowOf('l1'), jan, index)).toEqual(cell(100, null, 100));
    expect(originalCellOf(rowOf('l1'), 'total', index).reported).toBe(200);
    expect(originalCellOf(rowOf('l1'), jan, new Map())).toEqual({
      budget: null,
      actual: null,
      forecast: null,
      reported: null,
    });
  });

  it('indexes every account of the tree by id', () => {
    expect([...index.keys()].sort()).toEqual(['g', 'l1', 'l2']);
  });
});

describe('shareOfParent', () => {
  it('is the part over the total, as a ratio', () => {
    expect(shareOfParent(25, 100)).toBe(0.25);
    expect(shareOfParent(100, 100)).toBe(1);
    expect(shareOfParent(-10, 100)).toBe(-0.1);
  });

  it('is not defined without a part or with a total of nothing', () => {
    expect(shareOfParent(null, 100)).toBeNull();
    expect(shareOfParent(10, null)).toBeNull();
    expect(shareOfParent(10, 0)).toBeNull();
  });
});
