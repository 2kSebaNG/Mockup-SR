import { formatCurrencyDigits } from '@/lib/abastecimiento/currency-format';

describe('formatCurrencyDigits', () => {
  it('returns empty for an empty value', () => {
    expect(formatCurrencyDigits('', false)).toBe('');
  });

  it('groups digits with es-CL thousands separators', () => {
    expect(formatCurrencyDigits('1234500', false)).toBe('1.234.500');
    expect(formatCurrencyDigits('500', false)).toBe('500');
  });

  it('strips any non-digit characters (e.g. a previously-formatted value)', () => {
    expect(formatCurrencyDigits('1.234.500', false)).toBe('1.234.500');
    expect(formatCurrencyDigits('$1,234,500', false)).toBe('1.234.500');
  });

  it('drops a leading minus sign when negatives are not allowed', () => {
    expect(formatCurrencyDigits('-500', false)).toBe('500');
  });

  it('keeps a leading minus sign when negatives are allowed', () => {
    expect(formatCurrencyDigits('-500', true)).toBe('-500');
    expect(formatCurrencyDigits('-1234500', true)).toBe('-1.234.500');
  });

  it('returns a bare "-" while negatives are allowed and only the sign has been typed', () => {
    expect(formatCurrencyDigits('-', true)).toBe('-');
  });
});
