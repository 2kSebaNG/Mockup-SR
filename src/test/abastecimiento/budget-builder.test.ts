import {
  builderLines,
  cellKey,
  isBlockPaste,
  monthAfter,
  monthsFrom,
  nextVersionLabel,
  parseAmount,
  parsePasted,
  pasteBlock,
  spreadEvenly,
} from '@/lib/abastecimiento/budget-builder';

describe('nextVersionLabel', () => {
  it('is P0 for no budget and one past the highest otherwise', () => {
    expect(nextVersionLabel([])).toBe('P0');
    expect(nextVersionLabel(['P0', 'P2', 'P1'])).toBe('P3');
    expect(nextVersionLabel(['P9', 'Borrador'])).toBe('P10');
  });
});

describe('parseAmount', () => {
  it('reads the amounts a spreadsheet gives, in either convention', () => {
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('1,234,567')).toBe(1234567);
    expect(parseAmount('$ 1.234.567')).toBe(1234567);
    expect(parseAmount('1.234,50')).toBe(1234.5);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('1234')).toBe(1234);
    expect(parseAmount('1234.5')).toBe(1234.5);
    expect(parseAmount('1234,5')).toBe(1234.5);
    expect(parseAmount('0')).toBe(0);
  });

  it('takes a lone separator followed by three digits as thousands', () => {
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('12,345')).toBe(12345);
    expect(parseAmount('1,25')).toBe(1.25);
  });

  it('rounds to the cent', () => {
    expect(parseAmount('10,999')).toBe(10999);
    expect(parseAmount('10.126')).toBe(10126);
    expect(parseAmount('10,126.5')).toBe(10126.5);
    expect(parseAmount('0.456')).toBe(0.46);
  });

  it('is nothing for blank, text and negatives', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('12 mil')).toBeNull();
    expect(parseAmount('-500')).toBeNull();
  });
});

describe('what is pasted from a spreadsheet', () => {
  it('is rows of cells, without the empty line a copy ends with', () => {
    expect(parsePasted('1\t2\t3\r\n4\t5\t6\r\n')).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
    expect(parsePasted('7')).toEqual([['7']]);
    expect(parsePasted('')).toEqual([]);
  });

  it('is a block when it has more than one cell, and a value to type in otherwise', () => {
    expect(isBlockPaste('1\t2')).toBe(true);
    expect(isBlockPaste('1\n2')).toBe(true);
    expect(isBlockPaste('1.234.567')).toBe(false);
    expect(isBlockPaste('1.234\n')).toBe(false);
  });

  it('fills the cells going right and down from where it was pasted, leaving out what falls outside', () => {
    const result = pasteBlock(
      { [cellKey('a', '2026-05-01')]: '9' },
      [
        ['100', '200', '300'],
        ['1.500', 'x', '60'],
        ['7', '8', '9'],
      ],
      { row: 0, column: 1 },
      ['a', 'b'],
      ['2026-05-01', '2026-06-01', '2026-07-01'],
    );
    expect(result.edits).toEqual({
      [cellKey('a', '2026-05-01')]: '9',
      [cellKey('a', '2026-06-01')]: '100',
      [cellKey('a', '2026-07-01')]: '200',
      [cellKey('b', '2026-06-01')]: '1500',
      [cellKey('b', '2026-07-01')]: 'x',
    });
    // Two cells on the first row (the third is past the last month), two on the second (same,
    // and the 'x' stays as typed, to be flagged); the third row has no account to go in.
    expect(result.filled).toBe(4);
  });
});

describe('months', () => {
  it('counts months from a start, over the year', () => {
    expect(monthsFrom('2026-11', 4)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
    expect(monthsFrom('2026-05', 0)).toEqual([]);
    expect(monthsFrom('mal', 3)).toEqual([]);
  });

  it('is the month after another', () => {
    expect(monthAfter('2026-12-01')).toBe('2027-01-01');
    expect(monthAfter('2026-05-01')).toBe('2026-06-01');
  });
});

describe('spreadEvenly', () => {
  it('shares a total in equal parts', () => {
    expect(spreadEvenly(1200, 4)).toEqual([300, 300, 300, 300]);
  });

  it('puts the pesos that do not divide in the first parts, and adds up exactly', () => {
    const parts = spreadEvenly(100, 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(spreadEvenly(100.4, 3)).toEqual([34, 33, 33]);
  });

  it('is nothing for no parts', () => {
    expect(spreadEvenly(100, 0)).toEqual([]);
  });
});

describe('builderLines', () => {
  const original = new Map([
    [cellKey('a', '2026-05-01'), 100],
    [cellKey('a', '2026-06-01'), 200],
  ]);

  it('from a version sends only what differs from it', () => {
    const { lines, invalid } = builderLines(
      {
        [cellKey('a', '2026-05-01')]: '100',
        [cellKey('a', '2026-06-01')]: '250',
        [cellKey('b', '2026-05-01')]: '40',
      },
      original,
      false,
    );
    expect(invalid).toEqual([]);
    expect(lines).toEqual([
      { chartAccountId: 'a', period: '2026-06-01', budgetedAmount: 250 },
      { chartAccountId: 'b', period: '2026-05-01', budgetedAmount: 40 },
    ]);
  });

  it('from a version cannot empty a cell that has an amount: it is flagged', () => {
    const { lines, invalid } = builderLines({ [cellKey('a', '2026-05-01')]: '' }, original, false);
    expect(lines).toEqual([]);
    expect(invalid).toEqual([cellKey('a', '2026-05-01')]);
    // A cell that had nothing and is left empty is just not in it.
    expect(builderLines({ [cellKey('z', '2026-05-01')]: '' }, original, false).invalid).toEqual([]);
  });

  it('from nothing sends every cell with an amount, zero included, and skips the empty ones', () => {
    const { lines, invalid } = builderLines(
      {
        [cellKey('a', '2026-05-01')]: '100',
        [cellKey('a', '2026-06-01')]: '0',
        [cellKey('a', '2026-07-01')]: '',
      },
      new Map(),
      true,
    );
    expect(invalid).toEqual([]);
    expect(lines.map((line) => line.budgetedAmount)).toEqual([100, 0]);
  });

  it('flags what is not an amount, in either mode', () => {
    expect(builderLines({ [cellKey('a', '2026-05-01')]: 'abc' }, new Map(), true).invalid).toEqual([
      cellKey('a', '2026-05-01'),
    ]);
    expect(builderLines({ [cellKey('a', '2026-05-01')]: '-5' }, original, false).invalid).toEqual([
      cellKey('a', '2026-05-01'),
    ]);
  });
});
