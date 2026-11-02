import {
  adjustedAccountIds,
  diffAdjustments,
  flattenAccounts,
  historyState,
  monthsBetween,
  snapshotAdjustments,
} from '@/lib/abastecimiento/scenario-view';

const cell = (reported: number | null) => ({
  budget: null,
  actual: null,
  forecast: null,
  reported,
});

type TestAccount = Parameters<typeof flattenAccounts>[0][number];

function account(id: string, reported: number | null, children: TestAccount[] = []): TestAccount {
  return {
    chartAccountId: id,
    code: id,
    name: id,
    parentAccountId: null,
    byPeriod: {},
    totals: cell(reported),
    children,
  };
}

const adjustment = (id: string) =>
  ({ id, chartAccountId: 'a', projectId: 'p', period: '2026-08-01', deltaAmount: 1 }) as never;

describe('flattenAccounts', () => {
  it('lists parents before their children with depth', () => {
    const rows = flattenAccounts([account('1', 10, [account('1.1', 4), account('1.2', 6)])]);
    expect(rows.map((r) => [r.account.chartAccountId, r.depth])).toEqual([
      ['1', 0],
      ['1.1', 1],
      ['1.2', 1],
    ]);
  });
});

describe('adjustedAccountIds', () => {
  it('flags only the accounts whose real+projected changed, including their ancestors', () => {
    const real = [account('1', 10, [account('1.1', 4), account('1.2', 6)])];
    const scenario = [account('1', 12, [account('1.1', 4), account('1.2', 8)])];

    expect([...adjustedAccountIds(real, scenario)].sort()).toEqual(['1', '1.2']);
  });

  it('treats an account absent from the real report as 0', () => {
    const scenario = [account('9', 5)];
    expect([...adjustedAccountIds([], scenario)]).toEqual(['9']);
  });

  it('ignores sub-cent noise', () => {
    expect(adjustedAccountIds([account('1', 10)], [account('1', 10.001)]).size).toBe(0);
  });
});

describe('monthsBetween', () => {
  it('is inclusive and crosses a year boundary', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
  });

  it('is a single month when from equals to', () => {
    expect(monthsBetween('2026-08', '2026-08')).toEqual(['2026-08-01']);
  });

  it('is empty when backwards or malformed', () => {
    expect(monthsBetween('2026-12', '2026-08')).toEqual([]);
    expect(monthsBetween('', '2026-08')).toEqual([]);
  });
});

describe('diffAdjustments', () => {
  it('separates added from removed by id', () => {
    const diff = diffAdjustments(
      [adjustment('a'), adjustment('b')],
      [adjustment('b'), adjustment('c')],
    );
    expect(diff.added.map((a) => a.id)).toEqual(['c']);
    expect(diff.removed.map((a) => a.id)).toEqual(['a']);
  });
});

describe('snapshotAdjustments', () => {
  it('reads the adjustments list and tolerates a malformed snapshot', () => {
    expect(snapshotAdjustments({ adjustments: [adjustment('a')] })).toHaveLength(1);
    expect(snapshotAdjustments({})).toEqual([]);
    expect(snapshotAdjustments(null)).toEqual([]);
  });
});

describe('historyState', () => {
  const version = (ids: string[]) => ({ snapshot: { adjustments: ids.map(adjustment) } });

  it('is always unsaved as v1 before the first save', () => {
    expect(historyState([], [])).toEqual({ dirty: true, displayVersion: 1 });
  });

  it('is saved at the latest version number when nothing changed', () => {
    expect(historyState([version(['a']), version([])], [adjustment('a')])).toEqual({
      dirty: false,
      displayVersion: 2,
    });
  });

  it('is unsaved as the next version after an add or a removal', () => {
    expect(historyState([version(['a'])], [adjustment('a'), adjustment('b')])).toEqual({
      dirty: true,
      displayVersion: 2,
    });
    expect(historyState([version(['a'])], [])).toEqual({ dirty: true, displayVersion: 2 });
  });
});
