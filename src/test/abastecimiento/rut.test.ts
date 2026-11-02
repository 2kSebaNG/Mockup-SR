import { cleanRut, computeRutVerifier, formatRut, isValidRut, rutError } from '@/lib/abastecimiento/rut';

describe('cleanRut', () => {
  it('strips dots, dash and whitespace', () => {
    expect(cleanRut('12.345.678-5')).toBe('123456785');
  });

  it('uppercases a lowercase k verifier', () => {
    expect(cleanRut('99-k')).toBe('99K');
  });

  it('returns empty for empty/garbage input', () => {
    expect(cleanRut('')).toBe('');
    expect(cleanRut('abc')).toBe('');
  });

  it('caps the result at 9 characters so it cannot grow past a real RUT', () => {
    expect(cleanRut('1234567890123')).toBe('123456789');
  });
});

describe('computeRutVerifier', () => {
  it('computes the módulo-11 check digit for a real RUT body', () => {
    expect(computeRutVerifier('12345678')).toBe('5');
    expect(computeRutVerifier('78210317')).toBe('2');
  });

  it('maps a remainder of 10 to the letter K', () => {
    expect(computeRutVerifier('99')).toBe('K');
  });

  it('maps a remainder of 11 to 0', () => {
    expect(computeRutVerifier('76123456')).toBe('0');
  });
});

describe('isValidRut', () => {
  it('accepts a correctly formatted, checksum-valid RUT', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('78.210.317-2')).toBe(true);
  });

  it('accepts the same RUT unformatted', () => {
    expect(isValidRut('123456785')).toBe(true);
  });

  it('accepts a K verifier, in either case', () => {
    expect(isValidRut('99-K')).toBe(true);
    expect(isValidRut('99-k')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidRut('12.345.678-9')).toBe(false);
  });

  it('rejects a body that is not all digits, or input too short to have one', () => {
    expect(isValidRut('ABC-5')).toBe(false);
    expect(isValidRut('5')).toBe(false);
    expect(isValidRut('')).toBe(false);
  });
});

describe('formatRut', () => {
  it('groups the body with dots and appends the verifier after a dash', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
  });

  it('is idempotent on an already-formatted value', () => {
    expect(formatRut('12.345.678-5')).toBe('12.345.678-5');
  });

  it('formats incrementally while only part of the RUT has been typed', () => {
    expect(formatRut('1')).toBe('1');
    expect(formatRut('12')).toBe('1-2');
    expect(formatRut('1234')).toBe('123-4');
  });

  it('returns empty for empty input', () => {
    expect(formatRut('')).toBe('');
  });
});

describe('rutError', () => {
  it('is undefined for a blank value — nothing typed yet', () => {
    expect(rutError('')).toBeUndefined();
    expect(rutError('   ')).toBeUndefined();
  });

  it('flags an in-progress, too-short RUT as incomplete rather than invalid', () => {
    expect(rutError('12.345')).toBe('RUT incompleto.');
  });

  it('flags a complete but checksum-invalid RUT', () => {
    expect(rutError('12.345.678-9')).toBe('RUT inválido.');
  });

  it('is undefined once the RUT checks out', () => {
    expect(rutError('12.345.678-5')).toBeUndefined();
  });
});
