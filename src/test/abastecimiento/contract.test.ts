import { contractsNote, contratoDatesError, contratoPatch } from '@/lib/abastecimiento/contract';
import { formatAmount } from '@/lib/abastecimiento/format';

const base = { state: 'MATCHES' as const, total: 0, withoutAmount: 0, difference: 0 };

describe('contratoDatesError', () => {
  it('is fine when blank (indefinido), equal or in order', () => {
    expect(contratoDatesError('', '2026-12-31')).toBeUndefined();
    expect(contratoDatesError('2026-01-01', '')).toBeUndefined();
    expect(contratoDatesError('2026-01-01', '2026-01-01')).toBeUndefined();
  });

  it('flags an end before the start', () => {
    expect(contratoDatesError('2026-06-01', '2026-01-01')).toMatch(/anterior a su inicio/);
  });
});

describe('contractsNote', () => {
  it('invites to put the amounts when no contrato has one', () => {
    const note = contractsNote({ ...base, state: 'NO_AMOUNTS', withoutAmount: 2 }, 1_000_000);
    expect(note.tone).toBe('info');
    expect(note.text).toContain('Ningún contrato tiene monto');
    expect(note.text).toContain(formatAmount(1_000_000));
  });

  it('says they match when they add up', () => {
    const note = contractsNote({ ...base, total: 1000 }, 1000);
    expect(note).toEqual({
      tone: 'ok',
      text: `Los contratos suman ${formatAmount(1000)}: cuadran con el valor actual del negocio.`,
    });
  });

  it('warns how much they fall short', () => {
    const note = contractsNote(
      { state: 'BELOW', total: 600, withoutAmount: 0, difference: 400 },
      1000,
    );
    expect(note.tone).toBe('warn');
    expect(note.text).toContain(`${formatAmount(400)} menos que el valor actual`);
  });

  it('warns how much they go over, as a positive number', () => {
    const note = contractsNote(
      { state: 'ABOVE', total: 1200, withoutAmount: 0, difference: -200 },
      1000,
    );
    expect(note.tone).toBe('warn');
    expect(note.text).toContain(`${formatAmount(200)} más que el valor actual`);
  });

  it('also says how many contratos have no amount', () => {
    const one = contractsNote(
      { state: 'BELOW', total: 600, withoutAmount: 1, difference: 400 },
      1000,
    );
    expect(one.text).toContain('Hay 1 contrato sin monto.');
    const two = contractsNote(
      { state: 'BELOW', total: 600, withoutAmount: 2, difference: 400 },
      1000,
    );
    expect(two.text).toContain('Hay 2 contratos sin monto.');
  });
});

describe('contratoPatch', () => {
  it('trims the text and sends what was cleared as null', () => {
    expect(
      contratoPatch({ name: ' Obra ', code: ' C-1 ', startDate: '', endDate: '', amount: '' }),
    ).toEqual({ name: 'Obra', code: 'C-1', startDate: null, endDate: null, amount: null });
  });

  it('sends the dates and the amount as they are', () => {
    expect(
      contratoPatch({
        name: 'Obra',
        code: 'C-1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        amount: '1500000',
      }),
    ).toEqual({
      name: 'Obra',
      code: 'C-1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      amount: 1_500_000,
    });
  });

  it('keeps a zero amount, which is not the same as none', () => {
    expect(
      contratoPatch({ name: 'A', code: 'B', startDate: '', endDate: '', amount: '0' }).amount,
    ).toBe(0);
  });
});
