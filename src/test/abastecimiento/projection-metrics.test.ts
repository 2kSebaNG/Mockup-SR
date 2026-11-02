import {
  COMPARE_METRICS,
  DELTA_CHIP,
  METRIC_CHIPS,
  editableMetric,
  metricShortLabel,
  orderMetrics,
  summaryColumns,
  summaryValue,
  toggleMetric,
} from '@/lib/abastecimiento/projection-metrics';

describe('orderMetrics', () => {
  it('puts the months columns in a fixed order whatever the order they were turned on', () => {
    expect(orderMetrics(['forecast', 'budget', 'actual'])).toEqual([
      'budget',
      'actual',
      'forecast',
    ]);
    // Presupuesto, Real + Proyectado, Variación, then Real and Proyectado.
    expect(orderMetrics(['forecast', 'actual', 'variance', 'reported', 'budget'])).toEqual([
      'budget',
      'reported',
      'variance',
      'actual',
      'forecast',
    ]);
  });

  it('shows the IC view rather than an empty month', () => {
    expect(orderMetrics([])).toEqual(['reported']);
  });

  it('never repeats a column', () => {
    expect(orderMetrics(['actual', 'actual', 'budget'])).toEqual(['budget', 'actual']);
  });
});

describe('toggleMetric', () => {
  it('turns a column on in its place and off again', () => {
    const on = toggleMetric(['reported'], 'actual');
    expect(on).toEqual(['reported', 'actual']);
    expect(toggleMetric(on, 'actual')).toEqual(['reported']);
  });

  it('keeps the last column on: a month cannot have none', () => {
    expect(toggleMetric(['reported'], 'reported')).toEqual(['reported']);
  });

  it('can build the comparison one chip at a time', () => {
    let metrics = toggleMetric(['reported'], 'budget');
    metrics = toggleMetric(metrics, 'actual');
    metrics = toggleMetric(metrics, 'forecast');
    metrics = toggleMetric(metrics, 'reported');
    expect(metrics).toEqual(COMPARE_METRICS);
  });
});

describe('what can be typed into', () => {
  it('is the projection column when it is on screen', () => {
    expect(editableMetric(['budget', 'actual', 'forecast'])).toBe('forecast');
    expect(editableMetric(['forecast', 'reported'])).toBe('forecast');
  });

  it('is the real-or-projected column when the projection is not shown', () => {
    expect(editableMetric(['reported'])).toBe('reported');
    expect(editableMetric(['budget', 'reported'])).toBe('reported');
  });

  it('is nothing when neither is shown', () => {
    expect(editableMetric(['budget', 'actual'])).toBeNull();
    expect(editableMetric(['variance'])).toBeNull();
  });
});

describe('the columns before the months', () => {
  it('always has the budget, the total reported and the variation', () => {
    expect(summaryColumns(['reported']).map((c) => c.id)).toEqual([
      'sum:budget',
      'sum:reported',
      'sum:variance',
    ]);
  });

  it('adds the total real and the total projected when their months are on', () => {
    expect(summaryColumns(['actual', 'forecast']).map((c) => c.id)).toEqual([
      'sum:budget',
      'sum:reported',
      'sum:variance',
      'sum:actual',
      'sum:forecast',
    ]);
    expect(summaryColumns(['actual']).map((c) => c.id)).toContain('sum:actual');
    expect(summaryColumns(['actual']).map((c) => c.id)).not.toContain('sum:forecast');
  });

  it('reads each from the totals of a row', () => {
    const total = { budget: 100, actual: 60, forecast: 50, reported: 110 };
    expect(summaryValue(total, 'sum:budget')).toBe(100);
    expect(summaryValue(total, 'sum:actual')).toBe(60);
    expect(summaryValue(total, 'sum:forecast')).toBe(50);
    expect(summaryValue(total, 'sum:reported')).toBe(110);
    expect(summaryValue(total, 'sum:variance')).toBe(10);
  });

  it('leaves a variation blank when nothing was budgeted', () => {
    expect(
      summaryValue({ budget: null, actual: 1, forecast: null, reported: 1 }, 'sum:variance'),
    ).toBeNull();
  });
});

describe('labels', () => {
  it('has a short label for every month column and a chip for each', () => {
    for (const chip of METRIC_CHIPS) expect(metricShortLabel(chip.key)).toBeTruthy();
    expect(METRIC_CHIPS.map((c) => c.key).sort()).toEqual(
      ['actual', 'budget', 'forecast', 'reported', 'share', 'variance'].sort(),
    );
  });

  it('names the share of a group so that it says of what, and explains it', () => {
    const share = METRIC_CHIPS.find((chip) => chip.key === 'share');
    expect(share?.label).toBe('% del grupo');
    expect(share?.hint).toMatch(/grupo de cuentas/);
    expect(metricShortLabel('share')).toBe('% grupo');
  });
});

describe('the change against the original', () => {
  it('goes last in a month, after every other column', () => {
    expect(orderMetrics(['delta', 'budget', 'variance'])).toEqual(['budget', 'variance', 'delta']);
  });

  it('adds a summary column only when asked for', () => {
    expect(summaryColumns(['reported']).map((c) => c.id)).not.toContain('sum:delta');
    expect(summaryColumns(['reported'], true).map((c) => c.id)).toContain('sum:delta');
    expect(summaryColumns(['reported'], true).at(-1)?.id).toBe('sum:delta');
  });

  it('has a short label and its own chip, outside the ones every project shows', () => {
    expect(metricShortLabel('delta')).toBeTruthy();
    expect(DELTA_CHIP.key).toBe('delta');
    expect(METRIC_CHIPS.map((c) => c.key)).not.toContain('delta');
  });
});
