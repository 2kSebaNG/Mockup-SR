import type { components } from './api/schema';
import type { FormulaContext, RefResult } from './formula';
import { formatPeriod } from './format';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];

/**
 * References to other cells inside a formula. A reference is written between square
 * brackets, and says which account, and optionally which month and which figure:
 *
 *   [Materiales]                  the account, in the month of the cell being typed in
 *   [Materiales, ene]             in January (of that cell's year, or the only one there is)
 *   [Materiales, ene 2026]        in January 2026
 *   [Materiales, anterior]        in the month before (also: siguiente)
 *   [Materiales, real]            the real, not the real-or-projected (also: presupuesto, proyectado)
 *   [5.1, anterior, presupuesto]  the account's code works too, and the parts combine
 *
 * Without a month it is the month of the cell; without a figure it is "Real + Proyectado",
 * which is what the grid shows. What is read is what is on screen at that moment, typed
 * changes included.
 */

/** What the cell being typed in is, so a reference can mean "this month". */
export interface RefScope {
  /** The grid's accounts, as drawn (drafts and typed changes already in them). */
  accounts: AccountDetail[];
  periods: string[];
  cell: { chartAccountId: string; period: string };
}

type Figure = 'budget' | 'actual' | 'forecast' | 'reported';

const FIGURE_WORDS: Record<string, Figure> = {
  presupuesto: 'budget',
  presup: 'budget',
  real: 'actual',
  proyectado: 'forecast',
  proyeccion: 'forecast',
  proy: 'forecast',
  reportado: 'reported',
  'real+proyectado': 'reported',
};

const FIGURE_LABEL: Record<Figure, string> = {
  budget: 'Presupuesto',
  actual: 'Real',
  forecast: 'Proyectado',
  reported: 'Real + Proyectado',
};

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MONTH_HELP =
  'Después de la cuenta puedes poner un mes (ene, ene 2026, anterior, siguiente) ' +
  'y la cifra (presupuesto, real, proyectado).';

/** Lower case, no accents, single spaces: how names are compared. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function periodOf(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

function monthIndexOf(word: string): number | null {
  if (word.length < 3) return null;
  if (word === 'set' || word === 'sept') return 8;
  const index = MONTHS.findIndex((name) => name.startsWith(word));
  return index >= 0 ? index : null;
}

/** Every account of the tree by id. */
function indexAccounts(accounts: AccountDetail[]): Map<string, AccountDetail> {
  const index = new Map<string, AccountDetail>();
  const walk = (account: AccountDetail) => {
    index.set(account.chartAccountId, account);
    account.children.forEach(walk);
  };
  accounts.forEach(walk);
  return index;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j]! + 1, row[j - 1]! + 1, previous! + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = row[j];
      row[j] = next;
    }
  }
  return row[b.length]!;
}

/** The reader of references for one cell. */
export function createFormulaContext(scope: RefScope): FormulaContext {
  const accounts = indexAccounts(scope.accounts);
  const all = [...accounts.values()];
  const first = scope.periods[0];
  const last = scope.periods[scope.periods.length - 1];
  const [currentYear, currentMonth] = scope.cell.period.split('-').map(Number);

  function findAccount(text: string): { account: AccountDetail } | { error: string } {
    const wanted = normalize(text);
    if (wanted === '') {
      return { error: 'Escribe la cuenta entre corchetes, por ejemplo [Materiales].' };
    }
    const byCode = all.find((account) => normalize(account.code) === wanted);
    if (byCode) return { account: byCode };

    const named = all.filter((account) => normalize(account.name) === wanted);
    if (named.length === 1) return { account: named[0]! };
    if (named.length > 1) {
      return {
        error:
          `Hay ${named.length} cuentas llamadas «${text}» (códigos ${named.map((a) => a.code).join(', ')}): ` +
          `escribe el código, por ejemplo [${named[0]!.code}].`,
      };
    }

    const close = all
      .filter(
        (account) =>
          normalize(account.name).includes(wanted) ||
          wanted.includes(normalize(account.name)) ||
          distance(normalize(account.name), wanted) <= 2,
      )
      .slice(0, 3);
    return {
      error:
        `No encontré la cuenta «${text}».` +
        (close.length > 0
          ? ` ¿Quisiste decir ${close.map((a) => `«${a.name}»`).join(' o ')}?`
          : ''),
    };
  }

  /** The month a month-part names, or why it cannot be one. `null` means "not a month". */
  function findMonth(part: string): { period: string } | { error: string } | null {
    const text = normalize(part);
    if (['anterior', 'previo', 'mes anterior'].includes(text)) {
      return inRange(
        currentMonth === 1
          ? periodOf(currentYear! - 1, 11)
          : periodOf(currentYear!, currentMonth! - 2),
        'el mes anterior',
      );
    }
    if (['siguiente', 'proximo', 'mes siguiente'].includes(text)) {
      return inRange(
        currentMonth === 12 ? periodOf(currentYear! + 1, 0) : periodOf(currentYear!, currentMonth!),
        'el mes siguiente',
      );
    }
    if (['actual', 'este mes', 'mes actual'].includes(text)) return { period: scope.cell.period };

    const iso = /^(\d{4})-(\d{2})$/.exec(text);
    const named = /^([a-z]+)\.?\s*(\d{2}|\d{4})?$/.exec(text);
    let month: number | null = null;
    let year: number | null = null;
    if (iso) {
      month = Number(iso[2]) - 1;
      year = Number(iso[1]);
    } else if (named) {
      month = monthIndexOf(named[1]!);
      if (named[2]) year = named[2].length === 2 ? 2000 + Number(named[2]) : Number(named[2]);
    }
    if (month === null || month < 0 || month > 11) return null;

    if (year === null) {
      const candidates = scope.periods.filter((p) => Number(p.split('-')[1]) - 1 === month);
      const sameYear = candidates.find((p) => Number(p.split('-')[0]) === currentYear);
      const chosen =
        sameYear ??
        [...candidates].sort(
          (a, b) =>
            Math.abs(Number(a.split('-')[0]) - currentYear!) -
            Math.abs(Number(b.split('-')[0]) - currentYear!),
        )[0];
      return inRange(chosen ?? periodOf(currentYear!, month), part);
    }
    return inRange(periodOf(year, month), part);
  }

  /** A month inside the project's span (even one without figures: it reads as empty). */
  function inRange(period: string, said: string): { period: string } | { error: string } {
    if (!first || !last || period < first || period > last) {
      return {
        error: first
          ? `El proyecto no tiene ${said} (sus meses van de ${formatPeriod(first)} a ${formatPeriod(last!)}).`
          : 'El proyecto todavía no tiene meses.',
      };
    }
    return { period };
  }

  return {
    resolve(reference: string): RefResult {
      const [accountText, ...rest] = reference.split(',').map((part) => part.trim());
      const found = findAccount(accountText!);
      if ('error' in found) return { ok: false, error: found.error };

      let period = scope.cell.period;
      let figure: Figure = 'reported';
      let monthGiven = false;
      let figureGiven = false;
      for (const part of rest) {
        const word = FIGURE_WORDS[normalize(part).replace(/\s+/g, '')];
        if (word) {
          if (figureGiven) {
            return { ok: false, error: `En [${reference}] la cifra aparece dos veces.` };
          }
          figure = word;
          figureGiven = true;
          continue;
        }
        const month = findMonth(part);
        if (month === null) {
          return { ok: false, error: `No entendí «${part}» en [${reference}]. ${MONTH_HELP}` };
        }
        if ('error' in month) return { ok: false, error: month.error };
        if (monthGiven) {
          return { ok: false, error: `En [${reference}] el mes aparece dos veces.` };
        }
        period = month.period;
        monthGiven = true;
      }

      const cell: SummaryCell | undefined = accounts.get(found.account.chartAccountId)?.byPeriod[
        period
      ];
      const value = cell ? cell[figure] : null;
      const label =
        `${found.account.name} · ${formatPeriod(period)}` +
        (figure === 'reported' ? '' : ` · ${FIGURE_LABEL[figure]}`);
      return { ok: true, label, value };
    },
  };
}

/** What the person can pick for the part of a reference being written. */
export interface RefSuggestions {
  /** The text between these positions is replaced by what is picked. */
  from: number;
  to: number;
  items: { label: string; detail?: string; insert: string }[];
}

/** Whether an account's name can be written inside a reference as it is. */
function writable(account: AccountDetail): string {
  return /[,\]]/.test(account.name) ? account.code : account.name;
}

/**
 * Suggestions for the reference the caret is in, or `null` when it is not in one. While the
 * account is being written it lists accounts; after a comma, months and figures. Picking one
 * closes the bracket when it is still open.
 */
export function referenceSuggestions(
  text: string,
  caret: number,
  scope: RefScope,
): RefSuggestions | null {
  const open = text.lastIndexOf('[', caret - 1);
  if (open < 0 || text.slice(open, caret).includes(']')) return null;

  const closeAt = text.indexOf(']', caret);
  const needsClose = closeAt < 0;
  // The part being written: from after the last comma (or the bracket) up to the caret.
  const insideBefore = text.slice(open + 1, caret);
  const comma = insideBefore.lastIndexOf(',');
  const partFrom = open + 1 + comma + 1;
  const typed = text.slice(partFrom, caret);
  const query = normalize(typed);
  const leading = typed.length - typed.trimStart().length;
  const from = partFrom + leading;
  const tail = needsClose ? ']' : '';

  if (comma < 0) {
    const all = [...indexAccounts(scope.accounts).values()];
    const starts = all.filter(
      (a) => normalize(a.name).startsWith(query) || normalize(a.code).startsWith(query),
    );
    const contains = all.filter(
      (a) =>
        !starts.includes(a) &&
        (normalize(a.name).includes(query) || normalize(a.code).includes(query)),
    );
    const items = [...starts, ...contains].slice(0, 8).map((account) => ({
      label: account.name,
      detail: account.code,
      insert: writable(account) + tail,
    }));
    return { from, to: caret, items };
  }

  const words: { label: string; detail: string }[] = [
    { label: 'anterior', detail: 'mes anterior' },
    { label: 'siguiente', detail: 'mes siguiente' },
    ...scope.periods.map((p) => ({ label: formatPeriod(p), detail: 'mes' })),
    { label: 'presupuesto', detail: 'cifra' },
    { label: 'real', detail: 'cifra' },
    { label: 'proyectado', detail: 'cifra' },
  ];
  const items = words
    .filter((word) => normalize(word.label).startsWith(query) || query === '')
    .slice(0, 8)
    .map((word) => ({ label: word.label, detail: word.detail, insert: word.label + tail }));
  return { from, to: caret, items };
}

/** Formulas to start from, written with the cell's own account so they can be tried as they
 * are. */
export function exampleFormulas(scope: RefScope): { formula: string; hint: string }[] {
  const account = indexAccounts(scope.accounts).get(scope.cell.chartAccountId);
  const name = account ? writable(account) : 'Cuenta';
  const index = scope.periods.indexOf(scope.cell.period);
  const examples = [
    { formula: '=1200000+350000', hint: 'Suma montos.' },
    { formula: '=18%*4500000', hint: 'Un porcentaje de un monto.' },
  ];
  if (index > 0) {
    examples.push({
      formula: `=[${name}, anterior]*1,05`,
      hint: 'Lo del mes anterior, más un 5%.',
    });
  }
  examples.push({
    formula: `=SI([${name}]>1000000; 1000000; [${name}])`,
    hint: 'Con un tope de 1.000.000: el menor de los dos.',
  });
  return examples;
}
