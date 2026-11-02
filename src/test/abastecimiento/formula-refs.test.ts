import type { components } from '@/lib/abastecimiento/api/schema';
import { analyzeAmountInput, parseAmountInput } from '@/lib/abastecimiento/formula';
import {
  createFormulaContext,
  exampleFormulas,
  normalize,
  referenceSuggestions,
  type RefScope,
} from '@/lib/abastecimiento/formula-refs';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];

const JAN = '2026-01-01';
const FEB = '2026-02-01';
const MAR = '2026-03-01';
const JAN27 = '2027-01-01';

const cell = (
  budget: number | null,
  actual: number | null,
  forecast: number | null,
): SummaryCell => ({ budget, actual, forecast, reported: actual ?? forecast });

function account(
  id: string,
  code: string,
  name: string,
  byPeriod: Record<string, SummaryCell>,
  children: AccountDetail[] = [],
): AccountDetail {
  return {
    chartAccountId: id,
    code,
    name,
    parentAccountId: null,
    byPeriod,
    totals: cell(null, null, null),
    children,
  };
}

const materiales = account('m', '5.1', 'Materiales', {
  [JAN]: cell(1000, 900, null),
  [FEB]: cell(1000, null, 1100),
  [MAR]: cell(1000, null, null),
});
const mano = account('o', '5.2', 'Mano de obra', {
  [JAN]: cell(500, null, 450),
  [FEB]: cell(500, null, 480),
});
const grupo = account('g', '5', 'Costos directos', {}, [materiales, mano]);
const otro = account('x', '6.1', 'Otros, varios', { [FEB]: cell(null, null, 7) });

function scope(
  period = FEB,
  accounts: AccountDetail[] = [grupo, otro],
  periods = [JAN, FEB, MAR],
): RefScope {
  return { accounts, periods, cell: { chartAccountId: 'm', period } };
}

const ctx = (period = FEB) => createFormulaContext(scope(period));
const value = (input: string, period = FEB) => {
  const result = parseAmountInput(input, ctx(period));
  if (!result.ok) throw new Error(`"${input}" failed: ${result.error}`);
  return result.value;
};
const error = (input: string, period = FEB) => {
  const result = parseAmountInput(input, ctx(period));
  if (result.ok) throw new Error(`"${input}" should have failed, got ${result.value}`);
  return result.error;
};

describe('a reference to another cell', () => {
  it('is the account in the month of the cell being typed in, as Real + Proyectado', () => {
    expect(value('=[Materiales]')).toBe(1100); // Feb: no real, the projection
    expect(value('=[Materiales]', JAN)).toBe(900); // Jan: the real wins
  });

  it('can name another month, with or without the year', () => {
    expect(value('=[Materiales, ene]')).toBe(900);
    expect(value('=[Materiales, ene 2026]')).toBe(900);
    expect(value('=[Materiales, enero]')).toBe(900);
    expect(value('=[Materiales, 2026-01]')).toBe(900);
  });

  it('can name the month before or after', () => {
    expect(value('=[Mano de obra, anterior]')).toBe(450);
    expect(value('=[Mano de obra, siguiente]', JAN)).toBe(480);
  });

  it('can name the figure instead of Real + Proyectado', () => {
    expect(value('=[Materiales, presupuesto]')).toBe(1000);
    expect(value('=[Materiales, ene, real]')).toBe(900);
    expect(value('=[Materiales, proyectado]')).toBe(1100);
    expect(value('=[Materiales, real, ene]')).toBe(900);
  });

  it('finds the account by code, and ignores case, accents and extra spaces', () => {
    expect(value('=[5.2]')).toBe(480);
    expect(value('=[ mano  DE obra ]')).toBe(480);
    expect(normalize('  Áéí  Ñ ')).toBe('aei n');
  });

  it('works inside an operation, with spaces kept in names', () => {
    expect(value('=[Materiales]*1,1')).toBeCloseTo(1210);
    expect(value('=[Mano de obra, anterior] + [Materiales, ene]')).toBe(1350);
    expect(value('=SI([Materiales]>1000; 1000; [Materiales])')).toBe(1000);
  });

  it('can read a group: the sum of what is under it', () => {
    const groupWithFigures = account(
      'g',
      '5',
      'Costos directos',
      { [FEB]: cell(1500, null, 1580) },
      [materiales, mano],
    );
    const result = parseAmountInput(
      '=[Costos directos]',
      createFormulaContext(scope(FEB, [groupWithFigures])),
    );
    expect(result).toEqual({ ok: true, value: 1580 });
  });

  it('counts an empty cell as 0 and says so', () => {
    const analysis = analyzeAmountInput('=[Materiales, mar]+5', ctx());
    expect(analysis).toMatchObject({ kind: 'formula', value: 5 });
    if (analysis.kind === 'formula') {
      expect(analysis.warnings[0]).toMatch(/Materiales · mar 2026 está vacía/);
    }
  });

  it('reads a month inside the project that has no figure for the account as empty', () => {
    expect(value('=[Mano de obra, mar]+1')).toBe(1);
  });

  it('says when the account is unknown, suggesting a close one', () => {
    expect(error('=[Materiale]')).toMatch(/No encontré la cuenta «Materiale»/);
    expect(error('=[Materiale]')).toMatch(/¿Quisiste decir «Materiales»\?/);
    expect(error('=[Zzzzzzzz]')).not.toMatch(/Quisiste decir/);
    expect(error('=[]')).toMatch(/entre corchetes/);
  });

  it('asks for the code when two accounts share a name', () => {
    const twin = account('t', '7.1', 'Materiales', { [FEB]: cell(null, null, 1) });
    const result = parseAmountInput(
      '=[Materiales]',
      createFormulaContext(scope(FEB, [grupo, twin])),
    );
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/Hay 2 cuentas llamadas «Materiales».*5\.1, 7\.1/),
    });
  });

  it('says when a month is outside the project or not understood', () => {
    expect(error('=[Materiales, anterior]', JAN)).toMatch(
      /no tiene el mes anterior \(sus meses van de ene 2026 a mar 2026\)/,
    );
    expect(error('=[Materiales, ene 2030]')).toMatch(/no tiene ene 2030/);
    expect(error('=[Materiales, xyz]')).toMatch(/No entendí «xyz».*presupuesto, real, proyectado/);
    expect(error('=[Materiales, ene, feb]')).toMatch(/mes aparece dos veces/);
    expect(error('=[Materiales, real, presupuesto]')).toMatch(/cifra aparece dos veces/);
  });

  it('picks the year of the cell, or the nearest one that exists', () => {
    const periods = [JAN, FEB, MAR, JAN27];
    const multi = account('m', '5.1', 'Materiales', {
      [JAN]: cell(null, 1, null),
      [JAN27]: cell(null, 2, null),
    });
    const both = (period: string) =>
      parseAmountInput(
        '=[Materiales, ene]',
        createFormulaContext({ accounts: [multi], periods, cell: { chartAccountId: 'm', period } }),
      );
    expect(both(FEB)).toEqual({ ok: true, value: 1 });
    expect(both(JAN27)).toEqual({ ok: true, value: 2 });
  });

  it('explains a bracket that was not closed', () => {
    expect(error('=[Materiales')).toMatch(/Falta cerrar el corchete/);
  });

  it('is not available without a context, and says so', () => {
    const result = parseAmountInput('=[Materiales]');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/no se pueden usar referencias/),
    });
  });

  it('points to the brackets when an account is written without them', () => {
    expect(error('=Materiales*2')).toMatch(/entre corchetes, por ejemplo \[Materiales\]/);
  });
});

describe('the explanation of a formula', () => {
  it('lists each operation in order and ends with the result', () => {
    const analysis = analyzeAmountInput('=[Materiales, ene]*1,1+50', ctx());
    expect(analysis).toMatchObject({ kind: 'formula', value: 1040 });
    if (analysis.kind === 'formula') {
      expect(analysis.steps).toEqual([
        'Materiales · ene 2026 = 900',
        '900 × 1,1 = 990',
        '990 + 50 = 1.040',
      ]);
      expect(analysis.references).toEqual(['Materiales · ene 2026']);
    }
  });

  it('says a percentage and a condition in words', () => {
    const analysis = analyzeAmountInput('=SI(500>400; 18%*100; 1)');
    expect(analysis).toMatchObject({ kind: 'formula', value: 18 });
    if (analysis.kind === 'formula') {
      expect(analysis.steps).toEqual([
        '¿500 > 400? Sí',
        '18% = 0,18',
        '0,18 × 100 = 18',
        'Sí se cumple: se usa 18',
      ]);
    }
  });

  it('names the figure when it is not Real + Proyectado', () => {
    const analysis = analyzeAmountInput('=[Materiales, presupuesto]', ctx());
    if (analysis.kind === 'formula') {
      expect(analysis.steps[0]).toBe('Materiales · feb 2026 · Presupuesto = 1.000');
    }
  });

  it('warns about a negative result', () => {
    expect(analyzeAmountInput('=1-5')).toMatchObject({
      kind: 'formula',
      value: -4,
      warnings: ['El resultado es negativo.'],
    });
  });

  it('tells a plain amount, a blank and an error apart', () => {
    expect(analyzeAmountInput('1.500')).toEqual({ kind: 'amount', value: 1500 });
    expect(analyzeAmountInput('  ')).toEqual({ kind: 'blank' });
    expect(analyzeAmountInput('=1/0')).toEqual({
      kind: 'error',
      error: 'No se puede dividir por cero.',
    });
  });
});

describe('suggestions while writing a reference', () => {
  const s = scope();
  const at = (text: string) => referenceSuggestions(text, text.length, s);

  it('is nothing outside a reference', () => {
    expect(at('=1+')).toBeNull();
    expect(at('=[Materiales]+')).toBeNull();
  });

  it('lists the accounts that start with, then contain, what was typed', () => {
    const result = at('=[ma')!;
    expect(result.items.map((i) => i.label)).toEqual(['Materiales', 'Mano de obra']);
    expect(result.items[0]).toMatchObject({ detail: '5.1', insert: 'Materiales]' });
    expect(at('=[obra')!.items.map((i) => i.label)).toEqual(['Mano de obra']);
    expect(at('=[5.')!.items.map((i) => i.label)).toEqual(['Materiales', 'Mano de obra']);
  });

  it('replaces only the part being written, and does not close a bracket that is closed', () => {
    const text = '=[Mat]+1';
    const result = referenceSuggestions(text, 5, s)!;
    expect([result.from, result.to]).toEqual([2, 5]);
    expect(result.items[0]!.insert).toBe('Materiales');
  });

  it('writes an account whose name has a comma by its code', () => {
    expect(at('=[otros')!.items[0]).toMatchObject({ label: 'Otros, varios', insert: '6.1]' });
  });

  it('offers months and figures after a comma', () => {
    const result = at('=[Materiales, ')!;
    expect(result.items.map((i) => i.label)).toEqual(
      expect.arrayContaining([
        'anterior',
        'siguiente',
        'ene 2026',
        'presupuesto',
        'real',
        'proyectado',
      ]),
    );
    expect(at('=[Materiales, an')!.items.map((i) => i.label)).toEqual(['anterior']);
    expect(at('=[Materiales, an')!.items[0]!.insert).toBe('anterior]');
  });
});

describe('example formulas', () => {
  it('are written with the cell account, and the previous month only when there is one', () => {
    const feb = exampleFormulas(scope(FEB)).map((e) => e.formula);
    expect(feb).toContain('=[Materiales, anterior]*1,05');
    expect(feb).toContain('=SI([Materiales]>1000000; 1000000; [Materiales])');
    expect(exampleFormulas(scope(JAN)).map((e) => e.formula)).not.toContain(
      '=[Materiales, anterior]*1,05',
    );
  });

  it('can all be evaluated as they are', () => {
    for (const { formula } of exampleFormulas(scope(FEB))) {
      expect(parseAmountInput(formula, ctx(FEB)).ok).toBe(true);
    }
  });
});
