import {
  UNBROKEN_CONCEPT,
  breakdownKeys,
  conceptNameProblem,
  conceptsOf,
  monthPayload,
  monthShown,
  monthTotals,
  parseQuantity,
  repriceWrites,
  type ForecastItem,
} from '@/lib/abastecimiento/forecast-items';

const item = (
  patch: Partial<ForecastItem> & Pick<ForecastItem, 'concept' | 'period'>,
): ForecastItem => ({
  id: `${patch.concept}-${patch.period}`,
  projectId: 'p',
  chartAccountId: 'a1',
  quantity: null,
  unitPrice: null,
  amount: 0,
  updatedBy: 'u',
  updatedAt: '2026-01-01T00:00:00Z',
  ...patch,
});

const items: ForecastItem[] = [
  item({ concept: 'Camioneta', period: '2026-03-01', amount: 400000 }),
  item({ concept: 'Camioneta', period: '2026-04-01', amount: 400000 }),
  item({ concept: UNBROKEN_CONCEPT, period: '2026-03-01', amount: 100000 }),
  item({
    concept: 'Andamios',
    period: '2026-03-01',
    quantity: 30,
    unitPrice: 15000,
    amount: 450000,
  }),
  item({ concept: 'Otro', period: '2026-03-01', amount: 5, chartAccountId: 'a2' }),
];

describe('breakdownKeys', () => {
  it('names the cells that are made of concepts, once each', () => {
    expect([...breakdownKeys(items)].sort()).toEqual([
      'a1|2026-03-01',
      'a1|2026-04-01',
      'a2|2026-03-01',
    ]);
  });
});

describe('conceptsOf', () => {
  const rows = conceptsOf(items, 'a1');

  it('lists the concepts of the account only, "Sin desglosar" first and the rest by name', () => {
    expect(rows.map((row) => row.concept)).toEqual([UNBROKEN_CONCEPT, 'Andamios', 'Camioneta']);
  });

  it('keeps each month and adds the concept up', () => {
    const camioneta = rows.find((row) => row.concept === 'Camioneta')!;
    expect(Object.keys(camioneta.cells)).toEqual(['2026-03-01', '2026-04-01']);
    expect(camioneta.total).toBe(800000);
    expect(camioneta.unitPrice).toBeNull();
  });

  it('takes the unit price of a concept worked in quantities', () => {
    const andamios = rows.find((row) => row.concept === 'Andamios')!;
    expect(andamios.unitPrice).toBe(15000);
    expect(andamios.cells['2026-03-01']).toEqual({
      amount: 450000,
      quantity: 30,
      unitPrice: 15000,
    });
  });

  it('is nothing for an account with no concepts', () => {
    expect(conceptsOf(items, 'ghost')).toEqual([]);
  });
});

describe('monthTotals', () => {
  it('adds the concepts up per month, which is the projection of the account', () => {
    expect(monthTotals(conceptsOf(items, 'a1'))).toEqual({
      '2026-03-01': 950000,
      '2026-04-01': 400000,
    });
  });
});

describe('parseQuantity', () => {
  it('reads whole numbers and decimals with a comma or a point', () => {
    expect(parseQuantity('30')).toBe(30);
    expect(parseQuantity(' 2,5 ')).toBe(2.5);
    expect(parseQuantity('2.5')).toBe(2.5);
    expect(parseQuantity('0')).toBe(0);
  });

  it('is nothing for a blank, a negative or what is not a number', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('   ')).toBeNull();
    expect(parseQuantity('-3')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('1.2.3')).toBeNull();
  });
});

describe('monthPayload', () => {
  it('is the amount, in whole pesos, in a concept worked in amounts', () => {
    expect(monthPayload('120000', null)).toEqual({ amount: 120000 });
    expect(monthPayload('1000,6', null)).toEqual({ amount: 1001 });
  });

  it('is the quantity with the concept price in one worked with a unit price', () => {
    expect(monthPayload('30', 15000)).toEqual({ quantity: 30, unitPrice: 15000 });
  });

  it('is nothing for what is not a number', () => {
    expect(monthPayload('x', null)).toBeNull();
    expect(monthPayload('', 15000)).toBeNull();
  });
});

describe('monthShown', () => {
  const cell = { amount: 450000, quantity: 30, unitPrice: 15000 };

  it('shows the quantity in a concept with a unit price and the amount otherwise', () => {
    expect(monthShown(cell, 15000)).toBe('30');
    expect(monthShown({ amount: 100, quantity: null, unitPrice: null }, null)).toBe('100');
  });

  it('shows the amount of a month that has no quantity yet, and nothing for a month without', () => {
    expect(monthShown({ amount: 100, quantity: null, unitPrice: null }, 50)).toBe('100');
    expect(monthShown(undefined, null)).toBe('');
  });
});

describe('repriceWrites', () => {
  const row = conceptsOf(items, 'a1');
  const camioneta = row.find((r) => r.concept === 'Camioneta')!;
  const andamios = row.find((r) => r.concept === 'Andamios')!;

  it('gives a concept worked in amounts the quantity that makes the same amount', () => {
    expect(repriceWrites(camioneta, 200000)).toEqual([
      { period: '2026-03-01', quantity: 2, unitPrice: 200000 },
      { period: '2026-04-01', quantity: 2, unitPrice: 200000 },
    ]);
  });

  it('keeps the quantities of a concept that already had them and changes the price', () => {
    expect(repriceWrites(andamios, 20000)).toEqual([
      { period: '2026-03-01', quantity: 30, unitPrice: 20000 },
    ]);
  });

  it('turns the months into amounts again when the price is taken away', () => {
    expect(repriceWrites(andamios, null)).toEqual([{ period: '2026-03-01', amount: 450000 }]);
  });
});

describe('conceptNameProblem', () => {
  it('needs a name', () => {
    expect(conceptNameProblem('   ', [])).toMatch(/necesita un nombre/);
  });

  it('does not repeat a concept of the account, whatever the case or the spaces', () => {
    expect(conceptNameProblem(' camioneta  ', ['Camioneta'])).toMatch(/ya tiene/);
  });

  it('accepts a new one', () => {
    expect(conceptNameProblem('Andamios', ['Camioneta'])).toBeUndefined();
  });
});
