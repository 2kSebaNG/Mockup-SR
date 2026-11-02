import {
  dearestAndCheapest,
  formatPriceDeviation,
  formatSeniority,
  priceDeviation,
  priceRanking,
  priceTone,
  sortMetrics,
  thisYear,
  topBy,
  type VendorMetric,
} from '@/lib/abastecimiento/vendor-metrics';

const metric = (name: string, patch: Partial<VendorMetric> = {}): VendorMetric => ({
  id: name,
  name,
  taxId: null,
  active: true,
  categories: [],
  ordersCount: 0,
  orderedAmount: 0,
  paidAmount: 0,
  averageOrderAmount: 0,
  firstOrderDate: null,
  lastOrderDate: null,
  since: '2026-01-01',
  seniorityMonths: 0,
  priceIndex: null,
  comparedItems: 0,
  ...patch,
});

const vendors = [
  metric('Ñandú', { paidAmount: 500, ordersCount: 5, seniorityMonths: 30, priceIndex: 1.2 }),
  metric('Acero', { paidAmount: 900, ordersCount: 2, seniorityMonths: 3, priceIndex: 0.8 }),
  metric('Barro', { paidAmount: 0, ordersCount: 0, seniorityMonths: 40 }),
  metric('Cobre', { paidAmount: 900, ordersCount: 9, seniorityMonths: 12, priceIndex: 1.02 }),
  metric('Dedal', { paidAmount: 100, ordersCount: 1, seniorityMonths: 1, priceIndex: 0.9 }),
];

describe('sortMetrics', () => {
  const names = (list: VendorMetric[]) => list.map((item) => item.name);

  it('puts the one that was paid most first, ties by name', () => {
    expect(names(sortMetrics(vendors, 'paid'))).toEqual([
      'Acero',
      'Cobre',
      'Ñandú',
      'Dedal',
      'Barro',
    ]);
  });

  it('ranks by orders and by seniority, either way', () => {
    expect(names(sortMetrics(vendors, 'orders'))[0]).toBe('Cobre');
    expect(names(sortMetrics(vendors, 'seniority', 'desc'))[0]).toBe('Barro');
    expect(names(sortMetrics(vendors, 'seniority', 'asc'))[0]).toBe('Dedal');
  });

  it('puts the vendors with no price index last, whichever the direction', () => {
    expect(names(sortMetrics(vendors, 'price', 'desc'))).toEqual([
      'Ñandú',
      'Cobre',
      'Dedal',
      'Acero',
      'Barro',
    ]);
    expect(names(sortMetrics(vendors, 'price', 'asc')).at(-1)).toBe('Barro');
  });

  it('sorts names A to Z with the Spanish alphabet, and does not touch what it was given', () => {
    const input = [...vendors];
    expect(names(sortMetrics(input, 'name'))).toEqual([
      'Acero',
      'Barro',
      'Cobre',
      'Dedal',
      'Ñandú',
    ]);
    expect(input.map((item) => item.name)).toEqual(vendors.map((item) => item.name));
  });
});

describe('topBy', () => {
  it('takes the highest few and leaves out those with nothing in the measure', () => {
    expect(topBy(vendors, 'paid', 10).map((item) => item.name)).toEqual([
      'Acero',
      'Cobre',
      'Ñandú',
      'Dedal',
    ]);
    expect(topBy(vendors, 'orders', 2).map((item) => item.name)).toEqual(['Cobre', 'Ñandú']);
  });
});

describe('seniority and price in words', () => {
  it('writes years and months', () => {
    expect(formatSeniority(0)).toBe('menos de un mes');
    expect(formatSeniority(1)).toBe('1 mes');
    expect(formatSeniority(5)).toBe('5 meses');
    expect(formatSeniority(12)).toBe('1 año');
    expect(formatSeniority(20)).toBe('1 año y 8 meses');
    expect(formatSeniority(25)).toBe('2 años y 1 mes');
  });

  it('says how far from the average a price index is', () => {
    expect(priceDeviation(1.12)).toBe(0.12);
    expect(formatPriceDeviation(1.123)).toBe('12,3% sobre el promedio');
    expect(formatPriceDeviation(0.9)).toBe('10% bajo el promedio');
    expect(formatPriceDeviation(1.003)).toBe('en el promedio');
    expect(formatPriceDeviation(null)).toBe('sin comparables');
  });

  it('calls it bad or good from five points, neither before', () => {
    expect(priceTone(1.05)).toBe('bad');
    expect(priceTone(1.04)).toBeUndefined();
    expect(priceTone(0.95)).toBe('good');
    expect(priceTone(0.96)).toBeUndefined();
    expect(priceTone(null)).toBeUndefined();
  });
});

describe('who is dearer and who is cheaper', () => {
  it('ranks only those with an index, dearest first', () => {
    expect(priceRanking(vendors).map((item) => item.name)).toEqual([
      'Ñandú',
      'Cobre',
      'Dedal',
      'Acero',
    ]);
  });

  it('splits the dearest from the cheapest, nobody on both sides, the cheapest first', () => {
    const { dearest, cheapest } = dearestAndCheapest(vendors, 3);
    expect(dearest.map((item) => item.name)).toEqual(['Ñandú', 'Cobre']);
    expect(cheapest.map((item) => item.name)).toEqual(['Acero', 'Dedal']);
    expect(dearestAndCheapest(vendors, 1)).toMatchObject({
      dearest: [{ name: 'Ñandú' }],
      cheapest: [{ name: 'Acero' }],
    });
  });

  it('has nothing on either side without indexes', () => {
    expect(dearestAndCheapest([metric('Solo')], 3)).toEqual({ dearest: [], cheapest: [] });
  });
});

describe('thisYear', () => {
  it('goes from the first of January to today', () => {
    expect(thisYear(new Date(2026, 9, 9, 12))).toMatchObject({ from: '2026-01-01' });
  });
});
