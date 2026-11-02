import { computeGrossAmount, orderTotals, purchaseOrderTotal } from '@/lib/abastecimiento/purchase-order';
import {
  carriesRetention,
  formatRate,
  isFirstOfKind,
  parsePercent,
  rateInForce,
  ratesOf,
  taxesOfOrder,
  taxRateProblems,
  type TaxRate,
} from '@/lib/abastecimiento/tax-rates';

const rates: TaxRate[] = [
  { id: 'r25', kind: 'HONORARIOS_RETENTION', validFrom: '2025-01-01', percent: 14.5 },
  { id: 'r26', kind: 'HONORARIOS_RETENTION', validFrom: '2026-01-01', percent: 15.25 },
  { id: 'r24', kind: 'HONORARIOS_RETENTION', validFrom: '2024-01-01', percent: 13.75 },
  { id: 'iva', kind: 'IVA', validFrom: '2003-10-01', percent: 19 },
];

describe('the rates of a tax', () => {
  it('lists the ones of a tax with the most recent first', () => {
    expect(ratesOf(rates, 'HONORARIOS_RETENTION').map((rate) => rate.id)).toEqual([
      'r26',
      'r25',
      'r24',
    ]);
    expect(ratesOf(rates, 'IVA')).toHaveLength(1);
  });

  it('finds the one in force on a day, starting on the day it says', () => {
    expect(rateInForce(rates, 'HONORARIOS_RETENTION', '2026-10-09')?.percent).toBe(15.25);
    expect(rateInForce(rates, 'HONORARIOS_RETENTION', '2025-12-31')?.percent).toBe(14.5);
    expect(rateInForce(rates, 'HONORARIOS_RETENTION', '2026-01-01')?.percent).toBe(15.25);
    expect(rateInForce(rates, 'HONORARIOS_RETENTION', '2023-12-31')).toBeNull();
  });

  it('knows the first of a tax, which keeps its day and cannot be removed', () => {
    expect(isFirstOfKind(rates[2]!, rates)).toBe(true);
    expect(isFirstOfKind(rates[1]!, rates)).toBe(false);
    expect(isFirstOfKind(rates[3]!, rates)).toBe(true);
  });
});

describe('the taxes an order applies', () => {
  const today = { iva: 19, honorariosRetention: 15.25 };

  it('carries the retention only with a boleta de honorarios', () => {
    expect(carriesRetention('Boleta de honorarios')).toBe(true);
    expect(carriesRetention('Factura')).toBe(false);
    expect(taxesOfOrder(today, 'Boleta de honorarios')).toEqual({
      ivaPercent: 19,
      withholdingTaxPercent: 15.25,
    });
    expect(taxesOfOrder(today, 'Factura')).toEqual({ ivaPercent: 19, withholdingTaxPercent: null });
    expect(taxesOfOrder(today, null).withholdingTaxPercent).toBeNull();
  });

  it('has nothing until the rates are known, rather than a made-up number', () => {
    expect(taxesOfOrder(undefined, 'Boleta de honorarios')).toEqual({
      ivaPercent: null,
      withholdingTaxPercent: null,
    });
    expect(taxesOfOrder({ iva: null, honorariosRetention: null }, 'Factura').ivaPercent).toBeNull();
  });
});

describe('the totals with the taxes of the order', () => {
  it('uses the IVA given and 19% for an order that has none of its own', () => {
    expect(computeGrossAmount(100)).toBe(119);
    expect(computeGrossAmount(100, 20)).toBe(120);
    expect(orderTotals(1000, 'INVOICE', null, 21).total).toBe(1210);
    expect(orderTotals(1000, 'INVOICE').total).toBe(1190);
  });

  it('takes the retention before the IVA', () => {
    expect(orderTotals(1_000_000, 'INVOICE', 15.25, 19)).toMatchObject({
      withholding: 152_500,
      netAfterWithholding: 847_500,
      total: 1_008_525,
    });
  });

  it('reads both taxes off the order itself, and 19% when it has no IVA', () => {
    expect(
      purchaseOrderTotal({
        amount: 1_000_000,
        channel: 'INVOICE',
        metadata: { withholdingTaxPercent: 15.25, ivaPercent: 19 },
      }),
    ).toBe(1_008_525);
    expect(
      purchaseOrderTotal({ amount: 1000, channel: 'INVOICE', metadata: { ivaPercent: 20 } }),
    ).toBe(1200);
    expect(purchaseOrderTotal({ amount: 1000, channel: 'INVOICE', metadata: {} })).toBe(1190);
    expect(
      purchaseOrderTotal({ amount: 1000, channel: 'EXPENSE_REPORT', metadata: { ivaPercent: 20 } }),
    ).toBe(1000);
  });
});

describe('writing a rate', () => {
  it('reads the percent with a comma or a point', () => {
    expect(parsePercent('15,25')).toBe(15.25);
    expect(parsePercent(' 15.25% ')).toBe(15.25);
    expect(parsePercent('')).toBeNaN();
    expect(parsePercent('abc')).toBeNaN();
  });

  it('writes it as it is read in Chile', () => {
    expect(formatRate(15.25)).toBe('15,25%');
    expect(formatRate(19)).toBe('19%');
    expect(formatRate(null)).toBe('—');
  });

  it('says what is missing or wrong before it can be saved', () => {
    expect(taxRateProblems({ validFrom: '2027-01-01', percent: '16' })).toEqual([]);
    expect(taxRateProblems({ validFrom: '', percent: '' })).toEqual([
      'Falta la fecha desde la que rige.',
      'Falta el porcentaje.',
    ]);
    expect(taxRateProblems({ validFrom: '2027-01-01', percent: '101' })).toEqual([
      'El porcentaje tiene que estar entre 0 y 100.',
    ]);
    expect(taxRateProblems({ validFrom: '2027-01-01', percent: '15,255' })).toEqual([
      'El porcentaje admite hasta dos decimales.',
    ]);
  });
});
