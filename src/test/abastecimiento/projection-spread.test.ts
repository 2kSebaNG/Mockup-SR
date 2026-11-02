import {
  budgetBalance,
  defaultRange,
  distribute,
  monthsOfAccount,
  planSpread,
  shapeWeights,
  targetMonths,
  type SpreadMonth,
} from '@/lib/abastecimiento/projection-spread';

const month = (period: string, patch: Partial<Omit<SpreadMonth, 'period'>> = {}): SpreadMonth => ({
  period,
  budget: null,
  actual: null,
  forecast: null,
  ...patch,
});

const months: SpreadMonth[] = [
  month('2026-01-01', { budget: 100, actual: 90 }),
  month('2026-02-01', { budget: 100 }),
  month('2026-03-01', { budget: 300, forecast: 50 }),
  month('2026-04-01', { budget: 100 }),
];

describe('monthsOfAccount', () => {
  it('reads what the account holds in each month, in order, and blank where it has nothing', () => {
    const account = {
      byPeriod: {
        '2026-02-01': { budget: 10, actual: null, forecast: 5, reported: 5 },
        '2026-01-01': { budget: 20, actual: 18, forecast: null, reported: 18 },
      },
    } as never;
    expect(monthsOfAccount(account, ['2026-02-01', '2026-01-01', '2026-03-01'])).toEqual([
      { period: '2026-01-01', budget: 20, actual: 18, forecast: null, locked: false },
      { period: '2026-02-01', budget: 10, actual: null, forecast: 5, locked: false },
      { period: '2026-03-01', budget: null, actual: null, forecast: null, locked: false },
    ]);
  });
});

describe('budgetBalance', () => {
  it('is the budget minus the real', () => {
    expect(budgetBalance(months)).toBe(600 - 90);
  });

  it('is nothing when the account has no budget at all', () => {
    expect(budgetBalance([month('2026-01-01', { actual: 5 })])).toBeNull();
  });
});

describe('targetMonths', () => {
  it('leaves out the months with real and outside the range', () => {
    expect(targetMonths(months, '2026-01-01', '2026-03-01', false).map((m) => m.period)).toEqual([
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('also leaves out the projected ones when asked to respect them', () => {
    expect(targetMonths(months, '2026-01-01', '2026-04-01', true).map((m) => m.period)).toEqual([
      '2026-02-01',
      '2026-04-01',
    ]);
  });
});

describe('shapeWeights', () => {
  const three = [
    month('2026-02-01', { budget: 100 }),
    month('2026-03-01', { budget: 300 }),
    month('2026-04-01'),
  ];

  it('is the same for each month when even', () => {
    expect(shapeWeights('even', three)).toEqual([1, 1, 1]);
  });

  it('follows the budget of each month, and none for a month without', () => {
    expect(shapeWeights('budget', three)).toEqual([100, 300, 0]);
  });

  it('falls back to even when no month has a budget to follow', () => {
    expect(shapeWeights('budget', [month('2026-02-01'), month('2026-03-01')])).toEqual([1, 1]);
  });

  it('rises and falls by one part a month', () => {
    expect(shapeWeights('rising', three)).toEqual([1, 2, 3]);
    expect(shapeWeights('falling', three)).toEqual([3, 2, 1]);
  });

  it('takes what was written by hand, and none for a month left out or negative', () => {
    expect(shapeWeights('manual', three, { '2026-02-01': 2, '2026-04-01': -5 })).toEqual([2, 0, 0]);
  });
});

describe('distribute', () => {
  it('adds up to the total exactly, in whole pesos', () => {
    const parts = distribute(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('follows the weights', () => {
    expect(distribute(1000, [1, 3])).toEqual([250, 750]);
  });

  it('gives the pesos that do not divide to the largest remainders', () => {
    expect(distribute(10, [1, 2, 3])).toEqual([2, 3, 5]);
    expect(distribute(10, [1, 2, 3]).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('rounds the total to a whole peso', () => {
    expect(distribute(100.4, [1])).toEqual([100]);
  });

  it('shares nothing when no month takes a part', () => {
    expect(distribute(100, [0, 0])).toEqual([0, 0]);
    expect(distribute(100, [])).toEqual([]);
  });
});

describe('planSpread', () => {
  const base = { months, from: '2026-01-01', to: '2026-04-01', onlyEmpty: false };

  it('shares the total among the months that can take it and skips the one with real', () => {
    const plan = planSpread({ ...base, total: 900, shape: 'even' });
    expect(plan.problem).toBeUndefined();
    expect(plan.rows.map((row) => [row.period, row.amount, row.skip])).toEqual([
      ['2026-01-01', null, 'real'],
      ['2026-02-01', 300, null],
      ['2026-03-01', 300, null],
      ['2026-04-01', 300, null],
    ]);
    expect(plan.changes).toEqual([
      { period: '2026-02-01', amount: 300 },
      { period: '2026-03-01', amount: 300 },
      { period: '2026-04-01', amount: 300 },
    ]);
    expect(plan.total).toBe(900);
  });

  it('counts the projections it replaces', () => {
    const plan = planSpread({ ...base, total: 900, shape: 'even' });
    expect(plan.replaced).toBe(1);
  });

  it('respects the projected months and shares among the empty ones when asked', () => {
    const plan = planSpread({ ...base, total: 400, shape: 'even', onlyEmpty: true });
    expect(plan.rows.map((row) => [row.period, row.amount, row.skip])).toEqual([
      ['2026-01-01', null, 'real'],
      ['2026-02-01', 200, null],
      ['2026-03-01', null, 'kept'],
      ['2026-04-01', 200, null],
    ]);
    expect(plan.replaced).toBe(0);
    // What the months would hold: the parts and the 50 that was kept.
    expect(plan.total).toBe(450);
  });

  it('follows the budget when asked', () => {
    const plan = planSpread({ ...base, total: 500, shape: 'budget' });
    expect(plan.rows.filter((row) => row.amount !== null).map((row) => row.amount)).toEqual([
      100, 300, 100,
    ]);
  });

  it('leaves a month that takes no manual part as it is, not as a projection of nothing', () => {
    const plan = planSpread({
      ...base,
      total: 100,
      shape: 'manual',
      manual: { '2026-02-01': 1, '2026-04-01': 1 },
    });
    expect(plan.rows.find((row) => row.period === '2026-03-01')).toMatchObject({
      amount: null,
      skip: 'none',
    });
    expect(plan.changes.map((change) => change.period)).toEqual(['2026-02-01', '2026-04-01']);
  });

  it('does not list as a change a month that already holds that figure', () => {
    const plan = planSpread({
      months: [month('2026-02-01', { forecast: 100 }), month('2026-03-01')],
      from: '2026-02-01',
      to: '2026-03-01',
      total: 200,
      shape: 'even',
      onlyEmpty: false,
    });
    expect(plan.changes).toEqual([{ period: '2026-03-01', amount: 100 }]);
    expect(plan.replaced).toBe(0);
  });

  it('says why there is nothing to apply', () => {
    expect(
      planSpread({ ...base, total: 100, shape: 'even', from: '2026-04-01', to: '2026-02-01' })
        .problem,
    ).toMatch(/posterior/);
    expect(planSpread({ ...base, total: -1, shape: 'even' }).problem).toMatch(/mayor que cero/);
    expect(
      planSpread({ ...base, total: 100, shape: 'even', from: '2026-01-01', to: '2026-01-01' })
        .problem,
    ).toMatch(/real, proyección o conceptos/);
    expect(
      planSpread({ ...base, total: 100, shape: 'even', from: '2027-01-01', to: '2027-02-01' })
        .problem,
    ).toMatch(/Elige meses/);
    expect(planSpread({ ...base, total: 100, shape: 'manual' }).problem).toMatch(/partes/);
  });

  it('has no changes when there is a problem', () => {
    const plan = planSpread({ ...base, total: -5, shape: 'even' });
    expect(plan.changes).toEqual([]);
    expect(plan.replaced).toBe(0);
  });
});

describe('defaultRange', () => {
  it('goes from the first month without real to the last month', () => {
    expect(defaultRange(months)).toEqual({ from: '2026-02-01', to: '2026-04-01' });
  });

  it('is the last month alone when everything has real', () => {
    expect(
      defaultRange([month('2026-01-01', { actual: 1 }), month('2026-02-01', { actual: 2 })]),
    ).toEqual({ from: '2026-02-01', to: '2026-02-01' });
  });

  it('is empty without months', () => {
    expect(defaultRange([])).toEqual({ from: '', to: '' });
  });
});

describe('months made of concepts', () => {
  const locked = [
    month('2026-02-01', { budget: 100 }),
    month('2026-03-01', { budget: 100, forecast: 50, locked: true }),
    month('2026-04-01', { budget: 100 }),
  ];

  it('are marked from the cells that have concepts', () => {
    const account = { byPeriod: {} } as never;
    expect(
      monthsOfAccount(account, ['2026-02-01', '2026-03-01'], new Set(['2026-03-01'])).map(
        (m) => m.locked,
      ),
    ).toEqual([false, true]);
  });

  it('never get a part of the total, whatever the choice about what is projected', () => {
    for (const onlyEmpty of [false, true]) {
      const plan = planSpread({
        months: locked,
        from: '2026-02-01',
        to: '2026-04-01',
        total: 300,
        shape: 'even',
        onlyEmpty,
      });
      expect(plan.rows.map((row) => [row.period, row.amount, row.skip])).toEqual([
        ['2026-02-01', 150, null],
        ['2026-03-01', null, 'concepts'],
        ['2026-04-01', 150, null],
      ]);
      expect(plan.changes.map((change) => change.period)).toEqual(['2026-02-01', '2026-04-01']);
    }
  });
});
