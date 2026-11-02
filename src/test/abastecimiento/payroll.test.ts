import { initials, isActiveAssignment, monthsInclusive, projectedTotal } from '@/lib/abastecimiento/payroll';
import { formatShortAmount } from '@/lib/abastecimiento/format';

const contrato = {
  id: 'c1',
  code: 'SAC251001',
  name: 'Contrato',
  endDate: null as string | null,
  project: {
    id: 'p1',
    code: 'SAC251001',
    name: 'Proyecto',
    endDate: '2026-12-31' as string | null,
  },
};
const base = {
  employerCost: 1_000_000,
  startDate: '2026-01-15',
  endDate: null as string | null,
  contrato,
};
const officeStaff = { ...base, contrato: null };

describe('monthsInclusive', () => {
  it('counts both boundary months', () => {
    expect(monthsInclusive('2026-01-15', '2026-12-01')).toBe(12);
    expect(monthsInclusive('2026-03-01', '2026-03-31')).toBe(1);
  });

  it('is 0 when the end precedes the start', () => {
    expect(monthsInclusive('2026-05-01', '2026-02-01')).toBe(0);
  });
});

describe('projectedTotal', () => {
  it('uses the assignment end date first, then the contrato, then its project', () => {
    expect(projectedTotal({ ...base, endDate: '2026-06-30' })).toBe(6_000_000);
    expect(projectedTotal({ ...base, contrato: { ...contrato, endDate: '2026-03-31' } })).toBe(
      3_000_000,
    );
    expect(projectedTotal(base)).toBe(12_000_000);
  });

  it('is null when no horizon is known — including office staff with no contrato', () => {
    expect(
      projectedTotal({
        ...base,
        contrato: { ...contrato, project: { ...contrato.project, endDate: null } },
      }),
    ).toBeNull();
    expect(projectedTotal(officeStaff)).toBeNull();
  });
});

describe('isActiveAssignment', () => {
  it('is active with no end date or one still ahead', () => {
    expect(isActiveAssignment({ endDate: null }, '2026-09-23')).toBe(true);
    expect(isActiveAssignment({ endDate: '2026-09-23' }, '2026-09-23')).toBe(true);
    expect(isActiveAssignment({ endDate: '2026-09-22' }, '2026-09-23')).toBe(false);
  });
});

describe('initials / formatShortAmount', () => {
  it('builds initials from the first two words', () => {
    expect(initials('Marcela Rojas')).toBe('MR');
    expect(initials('Madonna')).toBe('MA');
  });

  it('shortens millions and thousands, and keeps small amounts exact', () => {
    expect(formatShortAmount(34_200_000)).toBe('$34,2M');
    expect(formatShortAmount(-408_600_000)).toBe('-$408,6M');
    expect(formatShortAmount(1_402_000_000)).toBe('$1.402M');
    expect(formatShortAmount(850_000)).toBe('$850K');
    expect(formatShortAmount(12_500)).toBe('$12,5K');
    expect(formatShortAmount(9_500)).toMatch(/9\.500/);
    expect(formatShortAmount(null)).toBe('—');
  });
});
