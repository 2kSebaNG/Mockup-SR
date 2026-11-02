import { formatPercent } from '@/lib/abastecimiento/format';
import { RETURN_LABEL, returnHelp, returnToDateText } from '@/lib/abastecimiento/returns';

describe('returnToDateText', () => {
  it('says the real-only return', () => {
    expect(returnToDateText(0.8)).toBe(`A la fecha (solo lo real): ${formatPercent(0.8)}.`);
    expect(returnToDateText(-0.1)).toBe(`A la fecha (solo lo real): ${formatPercent(-0.1)}.`);
  });

  it('says there are no sales yet when there is no figure', () => {
    expect(returnToDateText(null)).toBe('A la fecha (solo lo real): todavía no hay ventas.');
    expect(returnToDateText(undefined)).toBe('A la fecha (solo lo real): todavía no hay ventas.');
  });

  it('keeps a return of zero, which is not the same as no sales', () => {
    expect(returnToDateText(0)).toContain(formatPercent(0));
  });
});

describe('returnHelp', () => {
  it('explains how the projected return is made and gives the one to date', () => {
    const help = returnHelp(0.5);
    expect(help.startsWith(RETURN_LABEL)).toBe(true);
    expect(help).toContain('(ventas − costos) / ventas');
    expect(help).toContain('con lo real donde existe y la proyección donde no');
    expect(help).toContain(returnToDateText(0.5));
  });
});
