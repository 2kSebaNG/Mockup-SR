import {
  alertText,
  amountFromInput,
  amountToInput,
  percentFromInput,
  percentToInput,
  recommendationText,
  severityByAccount,
  watchMarks,
  watchText,
  watchTitle,
  whatIf,
  worstSeverity,
  type AlertOutlook,
  type ProjectAlert,
  type WatchedCell,
} from '@/lib/abastecimiento/alerts';

const alert = (partial: Partial<ProjectAlert>): ProjectAlert => ({
  rule: 'ACCOUNT_OVER_BUDGET',
  severity: 'warn',
  chartAccountId: null,
  accountName: null,
  period: null,
  amount: null,
  percent: null,
  threshold: null,
  ...partial,
});

describe('alertText', () => {
  it('says how far over an account is, with its name', () => {
    expect(
      alertText(alert({ accountName: 'Arriendo - Equipos', amount: 2_500_000, percent: 0.125 })),
    ).toBe('«Arriendo - Equipos» va $2.500.000 sobre su presupuesto (12,5% más).');
  });

  it('says a month, and a return against the minimum', () => {
    expect(
      alertText(alert({ rule: 'MONTH_OVER_BUDGET', period: '2026-07-01', amount: 300 })),
    ).toMatch(/jul 2026.*\$300/);
    expect(
      alertText(alert({ rule: 'PROFITABILITY_BELOW_MIN', percent: 0.12, threshold: 0.15 })),
    ).toBe('El retorno proyectado es 12%, bajo el mínimo esperado de 15%.');
    expect(alertText(alert({ rule: 'PROFITABILITY_NEGATIVE', amount: 1_000 }))).toMatch(
      /pierde plata/,
    );
  });
});

describe('recommendationText', () => {
  const outlook: AlertOutlook = {
    sales: 1000,
    costs: 800,
    profitability: 0.2,
    minProfitability: 0.1,
    headroom: 100,
  };
  const accounts = [
    { chartAccountId: 'a', name: 'Arriendo', amount: 500, percent: 0.2 },
    { chartAccountId: 'b', name: 'Combustible', amount: 300, percent: 0.1 },
  ];

  it('names the accounts to review and how much of the overrun they are', () => {
    expect(
      recommendationText({ kind: 'REVIEW_ACCOUNTS', amount: 800, accounts }, [], outlook),
    ).toMatch(/«Arriendo», «Combustible»: concentran \$800/);
  });

  it('tells a loss from a return under the minimum, and the room left with or without a minimum', () => {
    const cut = { kind: 'CUT_COSTS' as const, amount: 200, accounts: [] };
    expect(recommendationText(cut, [alert({ rule: 'PROFITABILITY_NEGATIVE' })], outlook)).toMatch(
      /dejar de perder/,
    );
    expect(recommendationText(cut, [alert({ rule: 'PROFITABILITY_BELOW_MIN' })], outlook)).toMatch(
      /retorno mínimo/,
    );
    const room = { kind: 'HEADROOM' as const, amount: 100, accounts: [] };
    expect(recommendationText(room, [], outlook)).toMatch(/hasta \$100 más.*mínimo de 10%/);
    expect(recommendationText(room, [], { ...outlook, minProfitability: null })).toMatch(
      /empiece a perder/,
    );
  });
});

describe('worstSeverity and severityByAccount', () => {
  it('is the worst among alerts, or nothing', () => {
    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity([alert({}), alert({ severity: 'critical' })])).toBe('critical');
    expect(worstSeverity([alert({})])).toBe('warn');
  });

  it('gives every group the worst of what is under it', () => {
    const tree = [
      {
        chartAccountId: 'group',
        children: [
          { chartAccountId: 'leaf1', children: [] },
          { chartAccountId: 'leaf2', children: [] },
        ],
      },
      { chartAccountId: 'other', children: [] },
    ];
    expect(severityByAccount(tree, { leaf1: 'warn', leaf2: 'critical' })).toEqual({
      leaf1: 'warn',
      leaf2: 'critical',
      group: 'critical',
    });
    expect(severityByAccount(tree, {})).toEqual({});
  });
});

describe('whatIf', () => {
  const outlook: AlertOutlook = {
    sales: 1000,
    costs: 800,
    profitability: 0.2,
    minProfitability: 0.15,
    headroom: 50,
  };

  it('says what the return would be after spending more, and whether it holds', () => {
    expect(whatIf(outlook, 0)).toMatchObject({
      profitability: 0.2,
      belowFloor: false,
      shortfall: 0,
    });
    expect(whatIf(outlook, 50)).toMatchObject({ belowFloor: false, headroomAfter: 0 });
    const over = whatIf(outlook, 100);
    expect(over.profitability).toBeCloseTo(0.1);
    expect(over).toMatchObject({ belowFloor: true, shortfall: 50, headroomAfter: -50 });
  });

  it('uses zero as the floor when no minimum is set', () => {
    const none = { ...outlook, minProfitability: null };
    expect(whatIf(none, 200)).toMatchObject({ belowFloor: false, headroomAfter: 0 });
    expect(whatIf(none, 300)).toMatchObject({ belowFloor: true, shortfall: 100 });
  });

  it('has nothing to say without sales', () => {
    expect(whatIf({ ...outlook, sales: null }, 100)).toEqual({
      profitability: null,
      belowFloor: false,
      shortfall: 0,
      headroomAfter: null,
    });
  });
});

describe('inputs', () => {
  it('reads and writes percentages and amounts the way they are typed', () => {
    expect(percentFromInput('12,5')).toBe(0.125);
    expect(percentFromInput(' 10 % ')).toBe(0.1);
    expect(percentFromInput('')).toBeNull();
    expect(percentFromInput('abc')).toBeNull();
    expect(percentToInput(0.125)).toBe('12,5');
    expect(percentToInput(0.1)).toBe('10');
    expect(percentToInput(null)).toBe('');

    expect(amountFromInput('1.500.000')).toBe(1_500_000);
    expect(amountFromInput('')).toBeNull();
    expect(amountToInput(1_500_000)).toBe('1.500.000');
    expect(amountToInput(undefined)).toBe('');
  });
});

describe('watched cells', () => {
  const watch = (partial: Partial<WatchedCell>): WatchedCell => ({
    id: 'w1',
    chartAccountId: 'a1',
    accountName: 'Materiales',
    period: '2026-06-01',
    direction: 'MAX',
    limit: 1_000_000,
    limitSource: 'OWN',
    reported: 400_000,
    share: 0.4,
    gap: -600_000,
    status: 'ok',
    ...partial,
  });

  it('names the cell by its account and month, or the whole project', () => {
    expect(watchTitle(watch({}))).toBe('Materiales · jun 2026');
    expect(watchTitle(watch({ period: null }))).toBe('Materiales · todo el proyecto');
  });

  it('says where a cost stands against its ceiling', () => {
    expect(watchText(watch({}))).toBe('$400.000 de tope $1.000.000: quedan $600.000 de margen.');
    expect(watchText(watch({ status: 'near', reported: 950_000, gap: -50_000 }))).toBe(
      '$950.000 de tope $1.000.000: cerca del tope, quedan $50.000.',
    );
    expect(watchText(watch({ status: 'near', reported: 1_000_000, gap: 0 }))).toBe(
      '$1.000.000 de tope $1.000.000: justo en el tope.',
    );
    expect(watchText(watch({ status: 'breached', reported: 1_200_000, gap: 200_000 }))).toBe(
      '$1.200.000 de tope $1.000.000: se pasó por $200.000.',
    );
  });

  it('says where an income stands against its floor', () => {
    const income = { direction: 'MIN' as const };
    expect(watchText(watch({ ...income, reported: 1_500_000, gap: -500_000 }))).toBe(
      '$1.500.000 de mínimo $1.000.000: sobran $500.000.',
    );
    expect(
      watchText(watch({ ...income, status: 'breached', reported: 700_000, gap: 300_000 })),
    ).toBe('$700.000 de mínimo $1.000.000: faltan $300.000.');
  });

  it('asks for a limit when there is nothing to compare to', () => {
    expect(watchText(watch({ limit: null, limitSource: null, status: 'unlimited' }))).toMatch(
      /^Sin tope: ponle uno/,
    );
    expect(
      watchText(watch({ limit: null, limitSource: null, status: 'unlimited', direction: 'MIN' })),
    ).toMatch(/^Sin mínimo/);
  });

  it('writes the alerts the watches raise', () => {
    const over = alert({
      rule: 'WATCH_OVER_LIMIT',
      accountName: 'Materiales',
      period: '2026-06-01',
      amount: 200_000,
      percent: 0.2,
      threshold: 1_000_000,
    });
    expect(alertText(over)).toBe(
      '«Materiales» en jun 2026 va $200.000 sobre el tope vigilado de $1.000.000 (20% más).',
    );
    expect(alertText({ ...over, rule: 'WATCH_UNDER_LIMIT', period: null })).toBe(
      '«Materiales» queda $200.000 bajo el mínimo vigilado de $1.000.000 (20% menos).',
    );
  });

  it('marks only the cells that are close or past, by account and month', () => {
    expect(
      watchMarks([
        watch({ id: '1', chartAccountId: 'a', status: 'breached' }),
        watch({ id: '2', chartAccountId: 'b', period: null, status: 'near' }),
        watch({ id: '3', chartAccountId: 'c', status: 'ok' }),
        watch({ id: '4', chartAccountId: 'd', status: 'unlimited' }),
      ]),
    ).toEqual({ 'a|2026-06-01': 'breached', 'b|total': 'near' });
  });
});
