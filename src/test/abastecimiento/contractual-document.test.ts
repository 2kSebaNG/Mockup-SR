import { parseExpiryFilter, validityError } from '@/lib/abastecimiento/contractual-document';

describe('parseExpiryFilter', () => {
  it('reads the status chip from the URL', () => {
    expect(parseExpiryFilter('EXPIRED')).toBe('EXPIRED');
    expect(parseExpiryFilter('EXPIRING_SOON')).toBe('EXPIRING_SOON');
    expect(parseExpiryFilter('CURRENT')).toBe('CURRENT');
  });

  it('falls back to all documents for anything else', () => {
    expect(parseExpiryFilter('')).toBe('ALL');
    expect(parseExpiryFilter(null)).toBe('ALL');
    expect(parseExpiryFilter('late')).toBe('ALL');
    expect(parseExpiryFilter('ALL')).toBe('ALL');
  });
});

describe('validityError', () => {
  it('is undefined when either date is blank or the order is fine', () => {
    expect(validityError('', '2026-01-01')).toBeUndefined();
    expect(validityError('2026-01-01', '')).toBeUndefined();
    expect(validityError('2026-01-01', '2026-01-01')).toBeUndefined();
    expect(validityError('2026-01-01', '2026-06-01')).toBeUndefined();
  });

  it('flags an end date before the start date', () => {
    expect(validityError('2026-06-01', '2026-01-01')).toMatch(/no puede ser anterior/);
  });
});
