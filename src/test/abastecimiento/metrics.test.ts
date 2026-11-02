import type { components } from '@/lib/abastecimiento/api/schema';
import {
  accountsAtLevel,
  heldAccounts,
  kindTotalsRow,
  mainAccounts,
  ownName,
  portfolioMetrics,
  mostConsumed,
  seriesOf,
  topWithRest,
  treeDepth,
  type AccountKind,
} from '@/lib/abastecimiento/metrics';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];
type PortfolioItem = components['schemas']['PortfolioItem'];

const cell = (
  budget: number | null,
  actual: number | null,
  forecast: number | null,
): SummaryCell => ({ budget, actual, forecast, reported: actual ?? forecast });

const node = (
  id: string,
  byPeriod: Record<string, SummaryCell>,
  totals: SummaryCell,
  children: AccountDetail[] = [],
): AccountDetail => ({
  chartAccountId: id,
  code: id,
  name: id,
  parentAccountId: null,
  byPeriod,
  totals,
  children,
});

const PERIODS = ['2026-05-01', '2026-06-01', '2026-07-01'];

// "costs" = a group with two leaves and 100 posted straight to it; "sales" = one income leaf.
const tree: AccountDetail[] = [
  node(
    'costs',
    {
      '2026-05-01': cell(1000, 400, null),
      '2026-06-01': cell(0, null, 350),
      '2026-07-01': cell(0, null, 250),
    },
    { budget: 1000, actual: 400, forecast: 600, reported: 1000 },
    [
      node(
        'rent',
        {
          '2026-05-01': cell(600, 300, null),
          '2026-06-01': cell(0, null, 200),
          '2026-07-01': cell(0, null, 100),
        },
        { budget: 600, actual: 300, forecast: 300, reported: 600 },
      ),
      node(
        'fuel',
        {
          '2026-05-01': cell(400, null, null),
          '2026-06-01': cell(0, null, 100),
          '2026-07-01': cell(0, null, 100),
        },
        { budget: 400, actual: null, forecast: 200, reported: 200 },
      ),
    ],
  ),
  node(
    'sales',
    {
      '2026-05-01': cell(null, 500, null),
      '2026-06-01': cell(null, null, 1000),
      '2026-07-01': cell(null, null, 1500),
    },
    { budget: null, actual: 500, forecast: 2500, reported: 3000 },
  ),
];
const kinds = new Map<string, AccountKind>([
  ['costs', 'COST'],
  ['rent', 'COST'],
  ['fuel', 'COST'],
  ['sales', 'INCOME'],
]);

describe('heldAccounts', () => {
  it('takes the leaves, and what a group holds beyond its children as an account of its own', () => {
    const held = heldAccounts(tree, PERIODS, kinds);
    expect(held.map((account) => account.name)).toEqual([
      'costs (sin subcuenta)',
      'rent',
      'fuel',
      'sales',
    ]);
    const own = held[0];
    // 400 real in May less the leaves' 300 real; June 350 projected less 200 + 100; July 250 less 200.
    expect(own!.byPeriod['2026-05-01']!.actual).toBe(100);
    expect(own!.byPeriod['2026-06-01']!.forecast).toBe(50);
    expect(own!.byPeriod['2026-07-01']!.forecast).toBe(50);
  });

  it('leaves out a group that holds nothing of its own', () => {
    const clean = [
      node('g', { '2026-05-01': cell(100, 50, null) }, cell(100, 50, null), [
        node('a', { '2026-05-01': cell(100, 50, null) }, cell(100, 50, null)),
      ]),
    ];
    expect(heldAccounts(clean, ['2026-05-01'], new Map()).map((a) => a.name)).toEqual(['a']);
  });
});

describe('seriesOf', () => {
  const held = heldAccounts(tree, PERIODS, kinds);

  it('splits each month into what is real and what is still a projection, and accumulates', () => {
    const costs = seriesOf(held, PERIODS, 'COST');
    expect(costs.points.map((p) => [p.real, p.projected])).toEqual([
      [400, 0],
      [0, 350],
      [0, 250],
    ]);
    expect(costs.points.map((p) => p.cumulative)).toEqual([400, 750, 1000]);
    expect(costs.points.map((p) => p.cumulativeReal)).toEqual([400, 400, 400]);
    expect(costs).toMatchObject({ budget: 1000, real: 400, projected: 600, reported: 1000 });
  });

  it('accumulates the budget month by month, and keeps the projection of a month that has real', () => {
    // The tree budgets 1000 in May only; June and July have a projection but no budget.
    const costs = seriesOf(held, PERIODS, 'COST');
    expect(costs.points.map((p) => [p.budget, p.cumulativeBudget])).toEqual([
      [1000, 1000],
      [0, 1000],
      [0, 1000],
    ]);
    // `forecast` is what was projected whether or not the month has real: so a month with real
    // and a projection shows both, where `projected` is only what is still to come.
    const withBoth = [
      {
        chartAccountId: 'x',
        name: 'x',
        kind: 'COST' as const,
        byPeriod: { '2026-05-01': { budget: 50, actual: 80, forecast: 60, reported: 80 } },
        totals: { budget: 50, actual: 80, forecast: 60, reported: 80 },
      },
    ];
    const point = seriesOf(withBoth, ['2026-05-01'], 'COST').points[0];
    expect(point).toMatchObject({ real: 80, projected: 0, forecast: 60, budget: 50 });
  });

  it('keeps income apart from costs', () => {
    const sales = seriesOf(held, PERIODS, 'INCOME');
    expect(sales).toMatchObject({ real: 500, projected: 2500, reported: 3000, budget: 0 });
  });
});

describe('mainAccounts', () => {
  it('opens the single root that holds the costs, most spent first, with its subtree', () => {
    // What was posted straight to the root is one more account, so the parts add up to the whole.
    expect(mainAccounts(tree, kinds).map((a) => [a.name, a.budget, a.reported])).toEqual([
      ['rent', 600, 600],
      ['fuel', 400, 200],
      ['costs (sin subcuenta)', 0, 200],
    ]);
  });

  it('shows the roots as they are when there are several', () => {
    const two = [tree[0]!, node('other', {}, cell(50, 70, null))];
    const more = new Map(kinds).set('other', 'COST');
    expect(mainAccounts(two, more).map((a) => a.name)).toEqual(['costs', 'other']);
  });

  it('lists the income accounts when asked', () => {
    expect(mainAccounts(tree, kinds, 'INCOME').map((a) => a.name)).toEqual(['sales']);
  });
});

describe('ownName', () => {
  it('says a share of a group is the part that belongs to none of its accounts', () => {
    expect(ownName('Arriendo')).toBe('Arriendo (sin subcuenta)');
  });
});

describe('accountsAtLevel', () => {
  const full = (budget: number, reported: number): SummaryCell => ({
    budget,
    actual: reported,
    forecast: null,
    reported,
  });
  // costs ─ rent ─ rent-eq (leaf) ; costs ─ fuel (leaf). rent holds 100 of its own.
  const deep: AccountDetail[] = [
    node('costs', {}, full(1000, 1000), [
      node('rent', {}, full(600, 600), [node('rent-eq', {}, full(500, 500))]),
      node('fuel', {}, full(400, 200)),
    ]),
    node('sales', {}, full(0, 3000)),
  ];
  const deepKinds = new Map<string, AccountKind>([
    ['costs', 'COST'],
    ['rent', 'COST'],
    ['rent-eq', 'COST'],
    ['fuel', 'COST'],
    ['sales', 'INCOME'],
  ]);
  const names = (level: Parameters<typeof accountsAtLevel>[3]) =>
    accountsAtLevel(deep, deepKinds, 'COST', level).map((a) => [a.name, a.reported]);

  it('is the level that suits the project by default', () => {
    expect(names('auto')).toEqual(names(undefined));
    expect(names('auto')).toEqual([
      ['rent', 600],
      ['fuel', 200],
      ['costs (sin subcuenta)', 200],
    ]);
  });

  it('shows the top-level groups at level 1', () => {
    expect(names(1)).toEqual([['costs', 1000]]);
  });

  it('opens one more level each time, a group with its subtree and what it holds of its own', () => {
    expect(names(2)).toEqual([
      ['rent', 600],
      ['fuel', 200],
      ['costs (sin subcuenta)', 200],
    ]);
    // rent is opened too: its leaf, and the 100 posted straight to rent.
    expect(names(3)).toEqual([
      ['rent-eq', 500],
      ['fuel', 200],
      ['costs (sin subcuenta)', 200],
      ['rent (sin subcuenta)', 100],
    ]);
  });

  it('goes down to the accounts with no sub-accounts, and stops there however deep it is asked', () => {
    expect(names('leaves')).toEqual(names(3));
    expect(names(9)).toEqual(names(3));
  });

  it('leaves out an own share that is nothing', () => {
    const clean = [node('g', {}, cell(100, 50, 50), [node('a', {}, cell(100, 50, 50))])];
    expect(accountsAtLevel(clean, new Map(), 'COST', 'leaves').map((a) => a.name)).toEqual(['a']);
  });
});

describe('accounts of mixed kinds', () => {
  const full = (budget: number, reported: number): SummaryCell => ({
    budget,
    actual: reported,
    forecast: null,
    reported,
  });
  // "rent" is income (a sale of 1000 was posted straight to it) while its sub-accounts are costs.
  const mixed: AccountDetail[] = [
    node('rent', {}, full(500, 1400), [
      node('rent-eq', {}, full(300, 300)),
      node('rent-ve', {}, full(200, 100)),
    ]),
    node('pay', {}, full(100, 66)),
  ];
  const mixedKinds = new Map<string, AccountKind>([
    ['rent', 'INCOME'],
    ['rent-eq', 'COST'],
    ['rent-ve', 'COST'],
    ['pay', 'COST'],
  ]);

  it('shows a group that is income with what its sub-accounts spent, leaving the sale out', () => {
    const names = (level: Parameters<typeof accountsAtLevel>[3]) =>
      accountsAtLevel(mixed, mixedKinds, 'COST', level).map((a) => [a.name, a.budget, a.reported]);
    // "rent" holds 400 of costs (300 + 100) and 500 of budget: the 1000 sale is not among them.
    expect(names('auto')).toEqual([
      ['rent', 500, 400],
      ['pay', 100, 66],
    ]);
    expect(names(1)).toEqual(names('auto'));
    // Opened, its sub-accounts; what it holds of its own is income, so there is no share of it.
    expect(names(2)).toEqual([
      ['rent-eq', 300, 300],
      ['rent-ve', 200, 100],
      ['pay', 100, 66],
    ]);
    expect(names('leaves')).toEqual(names(2));
  });

  it('leaves a sale posted to a group out of the costs and takes it as income', () => {
    expect(
      accountsAtLevel(mixed, mixedKinds, 'INCOME', 'auto').map((a) => [a.name, a.reported]),
    ).toEqual([['rent', 1000]]);
  });

  it('counts the levels the costs have', () => {
    expect(treeDepth(mixed, mixedKinds)).toBe(2);
    expect(treeDepth(mixed, mixedKinds, 'INCOME')).toBe(1);
  });
});

describe('treeDepth', () => {
  it('counts the levels of the accounts of a kind', () => {
    expect(treeDepth(tree, kinds)).toBe(2);
    expect(treeDepth(tree, kinds, 'INCOME')).toBe(1);
    expect(treeDepth([], kinds)).toBe(0);
  });
});

describe('topWithRest', () => {
  const accounts = ['a', 'b', 'c', 'd'].map((name, index) => ({
    chartAccountId: name,
    name,
    budget: 10,
    reported: 40 - index * 10,
  }));

  it('keeps the biggest and adds up the rest as one', () => {
    expect(topWithRest(accounts, 2)).toEqual([
      accounts[0],
      accounts[1],
      { chartAccountId: 'rest', name: 'Otras', budget: 20, reported: 30 },
    ]);
    expect(topWithRest(accounts, 4)).toEqual(accounts);
  });
});

describe('portfolio', () => {
  const item = (
    id: string,
    budget: number,
    reported: number,
    profitability: number | null,
    status: PortfolioItem['status'] = 'ACTIVE',
  ): PortfolioItem =>
    ({
      projectId: id,
      projectCode: id,
      projectName: id,
      businessUnitName: 'U',
      totalBudget: budget,
      totalActual: reported / 2,
      totalForecast: reported / 2,
      totalActualForecast: reported,
      profitability,
      documentsExpiringSoon: 0,
      nextDocumentExpiry: null,
      stage: 'IN_PROGRESS',
      status,
      suggestion: null,
    }) as PortfolioItem;

  const items = [
    item('a', 1000, 1200, -0.1),
    item('b', 1000, 500, 0.3, 'CLOSING'),
    item('c', 0, 100, null),
  ];

  it('adds up the projects and counts the ones in trouble', () => {
    expect(portfolioMetrics(items)).toMatchObject({
      projects: 3,
      budget: 2000,
      reported: 1800,
      real: 900,
      projected: 900,
      atRisk: 1,
      overBudget: 1,
    });
    expect(portfolioMetrics(items).consumed).toBeCloseTo(0.9);
    expect(portfolioMetrics(items).averageReturn).toBeCloseTo(0.1);
    expect(portfolioMetrics(items).withReturn).toBeGreaterThan(0);
    expect(portfolioMetrics(items).variance).toBe(1800 - 2000);
    expect(portfolioMetrics(items).variancePercent).toBeCloseTo(-0.1);
    expect(portfolioMetrics(items).byStatus).toEqual([
      { status: 'ACTIVE', count: 2 },
      { status: 'CLOSING', count: 1 },
    ]);
  });

  it('has no share or return to give when there is nothing to divide', () => {
    expect(portfolioMetrics([item('c', 0, 100, null)])).toMatchObject({
      consumed: null,
      averageReturn: null,
      withReturn: 0,
      variancePercent: null,
    });
  });

  it('says how far above the budget the portfolio is, as an amount and as a share of it', () => {
    const over = portfolioMetrics([item('a', 1000, 1500, 0.2), item('b', 1000, 1100, null)]);
    expect(over.variance).toBe(600);
    expect(over.variancePercent).toBeCloseTo(0.3);
    expect(over.withReturn).toBe(1);
  });

  it('counts a project with no budget in the variance, as it counts in the total spent', () => {
    expect(portfolioMetrics([item('a', 0, 500, null)]).variance).toBe(500);
  });

  it('orders the projects by how much of their budget they have used', () => {
    expect(mostConsumed(items, 5).map((i) => i.projectId)).toEqual(['a', 'b']);
    expect(mostConsumed(items, 1).map((i) => i.projectId)).toEqual(['a']);
  });
});

describe('kindTotalsRow', () => {
  const held = heldAccounts(tree, PERIODS, kinds);

  it('adds up what the project costs, month by month and over the whole span', () => {
    const costs = kindTotalsRow(held, PERIODS, 'COST', 'Total costos')!;
    expect(costs.name).toBe('Total costos');
    expect(costs.totals).toMatchObject({
      budget: 1000,
      actual: 400,
      forecast: 600,
      reported: 1000,
    });
    expect(costs.byPeriod['2026-05-01']).toMatchObject({
      budget: 1000,
      actual: 400,
      reported: 400,
    });
    expect(costs.byPeriod['2026-06-01']).toMatchObject({
      actual: null,
      forecast: 350,
      reported: 350,
    });
    expect(costs.children).toEqual([]);
  });

  it('counts a share posted straight to a group once, with the accounts under it', () => {
    // The tree's group holds 400 in May, of which 300 is in its leaves and 100 is its own.
    const may = kindTotalsRow(held, PERIODS, 'COST', 'Total')!.byPeriod['2026-05-01'];
    expect(may!.actual).toBe(400);
  });

  it('keeps income apart from costs, and is nothing for a kind the project does not have', () => {
    expect(kindTotalsRow(held, PERIODS, 'INCOME', 'Total ventas')!.totals.reported).toBe(3000);
    expect(
      kindTotalsRow(
        held.filter((a) => a.kind === 'COST'),
        PERIODS,
        'INCOME',
        'x',
      ),
    ).toBeNull();
    expect(kindTotalsRow([], PERIODS, 'COST', 'x')).toBeNull();
  });
});
