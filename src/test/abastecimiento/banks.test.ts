import { BANKS, bankChoices, isBank } from '@/lib/abastecimiento/banks';

describe('the banks', () => {
  it('knows the ones of the list, and only those', () => {
    expect(isBank('Scotiabank')).toBe(true);
    expect(isBank('Scotia')).toBe(false);
    expect(isBank('')).toBe(false);
    expect(isBank(null)).toBe(false);
  });

  it('offers the list, with no bank twice', () => {
    expect(bankChoices('')).toEqual([...BANKS]);
    expect(bankChoices('Scotiabank')).toEqual([...BANKS]);
    expect(new Set(BANKS).size).toBe(BANKS.length);
  });

  it('offers a bank saved as free text first, so it still shows until one is picked', () => {
    expect(bankChoices(' Banco Raro ')[0]).toBe('Banco Raro');
    expect(bankChoices('Banco Raro')).toHaveLength(BANKS.length + 1);
  });
});
