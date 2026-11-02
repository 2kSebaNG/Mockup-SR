import type { components } from '@/lib/abastecimiento/api/schema';
import {
  evaluateCalculation,
  needsSaving,
  periodFor,
  savedNote,
  visibilityText,
} from '@/lib/abastecimiento/calculations';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];

const cell = (
  budget: number | null,
  actual: number | null,
  forecast: number | null,
): SummaryCell => ({
  budget,
  actual,
  forecast,
  reported: actual ?? forecast,
});

const PERIODS = ['2026-05-01', '2026-06-01', '2026-07-01'];
const accounts: AccountDetail[] = [
  {
    chartAccountId: 'mat',
    code: '5.1',
    name: 'Materiales',
    parentAccountId: null,
    byPeriod: {
      '2026-05-01': cell(1000, 900, null),
      '2026-06-01': cell(1000, null, 1100),
      '2026-07-01': cell(1000, null, 1200),
    },
    totals: { budget: 3000, actual: 900, forecast: 2300, reported: 3200 },
    children: [],
  },
];
const context = { accounts, periods: PERIODS };

describe('periodFor', () => {
  it('is the month it names when the project has it, and the latest otherwise', () => {
    expect(periodFor('2026-06-01', PERIODS)).toBe('2026-06-01');
    expect(periodFor('2025-01-01', PERIODS)).toBe('2026-07-01');
    expect(periodFor(null, PERIODS)).toBe('2026-07-01');
    expect(periodFor(null, [])).toBeNull();
  });
});

describe('evaluateCalculation', () => {
  it('works out a formula the way a cell does, in the month it is read in', () => {
    const result = evaluateCalculation('=[Materiales]*10%', '2026-06-01', context);
    expect(result).toMatchObject({ ok: true, value: 110 });
    const latest = evaluateCalculation('=[Materiales]*10%', null, context);
    expect(latest).toMatchObject({ ok: true, value: 120 });
  });

  it('reads other months and other figures', () => {
    expect(
      evaluateCalculation('=[Materiales, presupuesto]-[Materiales, anterior]', null, context),
    ).toMatchObject({
      ok: true,
      value: 1000 - 1100,
    });
    expect(evaluateCalculation('=[Materiales, ene 2026, real]', null, context)).toMatchObject({
      ok: false,
    });
  });

  it('says what is wrong, in words', () => {
    const result = evaluateCalculation('=[Fantasma]*2', null, context);
    expect(result.ok).toBe(false);
    expect(evaluateCalculation('=1+', null, context)).toMatchObject({ ok: false });
    expect(evaluateCalculation('=1+1', null, { accounts, periods: [] })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/meses/),
    });
  });

  it('takes a plain amount, and a blank one as nothing', () => {
    expect(evaluateCalculation('1500', null, context)).toMatchObject({ ok: true, value: 1500 });
    expect(evaluateCalculation('  ', null, context)).toMatchObject({ ok: true, value: null });
  });
});

describe('needsSaving', () => {
  it('is when the live figure differs from the saved one, to the cent', () => {
    expect(needsSaving(110, null)).toBe(true);
    expect(needsSaving(110.004, 110)).toBe(false);
    expect(needsSaving(110.5, 110)).toBe(true);
    expect(needsSaving(null, 110)).toBe(false);
  });
});

describe('texts', () => {
  it('says who sees a calculation', () => {
    expect(visibilityText({ visibleToRoles: [] })).toBe('Solo su autor');
    expect(visibilityText({ visibleToRoles: ['Administrator', 'Procurement'] })).toBe(
      'Visible para Administrator, Procurement',
    );
  });

  it('dates the saved figure', () => {
    expect(savedNote({ lastCalculatedAt: null, createdByName: 'Ana' })).toMatch(/Sin valor/);
    expect(savedNote({ lastCalculatedAt: '2026-10-01T12:00:00Z', createdByName: 'Ana' })).toBe(
      'Calculado por Ana el 01-10-2026',
    );
  });
});
