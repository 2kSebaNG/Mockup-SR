import { formatAmount } from '@/lib/abastecimiento/format';
import {
  MIXED_ADVICE,
  conflictCounts,
  conflictText,
  fixLabel,
  type KindConflict,
} from '@/lib/abastecimiento/kind-conflicts';

const conflict = (patch: Partial<KindConflict>): KindConflict => ({
  id: 'a',
  code: '1.1',
  name: 'Estados de pago',
  kind: 'COST',
  problem: 'SALES_ON_COST',
  salesCount: 3,
  salesTotal: 1500,
  costCount: 0,
  costTotal: 0,
  suggestedKind: 'INCOME',
  ...patch,
});

describe('conflictText', () => {
  it('says what a cost account holds that is not a cost, how much, and what the return does', () => {
    expect(conflictText(conflict({}))).toBe(
      `Está marcada como costo, pero tiene 3 movimientos de venta (${formatAmount(1500)}): el retorno las cuenta como costos.`,
    );
  });

  it('says the same for an income account that holds costs', () => {
    expect(
      conflictText(
        conflict({
          kind: 'INCOME',
          problem: 'COSTS_ON_INCOME',
          salesCount: 0,
          salesTotal: 0,
          costCount: 1,
          costTotal: 250,
          suggestedKind: 'COST',
        }),
      ),
    ).toBe(
      `Está marcada como ingreso, pero tiene 1 movimiento de costo (${formatAmount(250)}): el retorno las cuenta como ventas.`,
    );
  });
});

describe('conflictText for a mixed account', () => {
  it('also says the other side that is booked to it', () => {
    const text = conflictText(conflict({ costCount: 2, costTotal: 100, suggestedKind: null }));
    expect(text).toContain('Está marcada como costo, pero tiene 3 movimientos de venta');
    expect(text).toContain(`También tiene 2 movimientos de costo (${formatAmount(100)}).`);
    const income = conflictText(
      conflict({
        kind: 'INCOME',
        problem: 'COSTS_ON_INCOME',
        salesCount: 1,
        salesTotal: 50,
        costCount: 2,
        costTotal: 100,
        suggestedKind: null,
      }),
    );
    expect(income).toContain(`También tiene 1 movimiento de venta (${formatAmount(50)}).`);
  });
});

describe('fixLabel', () => {
  it('names the kind the account would get', () => {
    expect(fixLabel('INCOME')).toBe('Marcar como ingreso');
    expect(fixLabel('COST')).toBe('Marcar como costo');
  });
});

describe('conflictCounts', () => {
  it('counts the accounts a kind fixes and the mixed ones', () => {
    expect(
      conflictCounts([
        conflict({}),
        conflict({ id: 'b', suggestedKind: 'COST' }),
        conflict({ id: 'c', suggestedKind: null }),
      ]),
    ).toEqual({ fixable: 2, mixed: 1 });
    expect(conflictCounts([])).toEqual({ fixable: 0, mixed: 0 });
  });
});

describe('MIXED_ADVICE', () => {
  it('says why no kind fits and what would', () => {
    expect(MIXED_ADVICE).toContain('cuentas distintas');
  });
});
