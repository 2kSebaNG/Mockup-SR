import { formatPeriod } from './format';

/**
 * Months grouped into quarters, semesters or years, so a long project does not stretch the
 * grid far to the right. A group is a column like a month: its figures are the sum of the
 * months in it (see `rowCell`), and it is read-only — a projection is typed in a month.
 *
 * A group is named by a key that carries the months it covers, so any figure can be read
 * from it without a table of groups: `g:Q:2026-1` is the first quarter of 2026, `g:S:2026-2`
 * the second semester, `g:Y:2026` the year. Calendar quarters and semesters.
 */
export type PeriodGrouping = 'month' | 'quarter' | 'semester' | 'year';

export const GROUPINGS: { key: PeriodGrouping; label: string }[] = [
  { key: 'month', label: 'Mes' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'semester', label: 'Semestre' },
  { key: 'year', label: 'Año' },
];

/** What the grouping the person last chose is, if it is one that exists. */
export function parseGrouping(value: string | null | undefined): PeriodGrouping {
  return GROUPINGS.find((grouping) => grouping.key === value)?.key ?? 'month';
}

const LETTER: Record<Exclude<PeriodGrouping, 'month'>, string> = {
  quarter: 'Q',
  semester: 'S',
  year: 'Y',
};

const SPAN: Record<Exclude<PeriodGrouping, 'month'>, number> = {
  quarter: 3,
  semester: 6,
  year: 12,
};

const KEY = /^g:([QSY]):(\d{4})(?:-(\d))?$/;

export function isGroupKey(key: string): boolean {
  return KEY.test(key);
}

/** The key of the group a month falls in; the month itself for "mes". */
export function groupKeyOf(period: string, grouping: PeriodGrouping): string {
  if (grouping === 'month') return period;
  const [year, month] = period.split('-').map(Number);
  const index = Math.floor((month! - 1) / SPAN[grouping]) + 1;
  return grouping === 'year' ? `g:Y:${year}` : `g:${LETTER[grouping]}:${year}-${index}`;
}

/** Every calendar month a group covers, whether or not there are figures in it; the month
 * itself for a month. */
export function monthsOfKey(key: string): string[] {
  const match = KEY.exec(key);
  if (!match) return [key];
  const [, letter, yearText, indexText] = match;
  const year = Number(yearText);
  const span = letter === 'Q' ? 3 : letter === 'S' ? 6 : 12;
  const first = letter === 'Y' ? 0 : (Number(indexText) - 1) * span;
  return Array.from({ length: span }, (_, i) => {
    const month = first + i + 1;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  });
}

/** "T1 2026", "S2 2026", "2026"; a month is named as everywhere else. */
export function periodLabel(key: string): string {
  const match = KEY.exec(key);
  if (!match) return formatPeriod(key);
  const [, letter, year, index] = match;
  if (letter === 'Y') return year!;
  return `${letter === 'Q' ? 'T' : 'S'}${index} ${year}`;
}

/** One column of the period part of the grid. */
export interface PeriodColumn {
  /** The month, or the group's key: what pins, marks and cells are stored against. */
  key: string;
  label: string;
  kind: 'month' | 'group';
  /** The months with figures it stands for. */
  months: string[];
  /** For a month inside an expanded group, the group it belongs to. */
  within?: string;
}

/**
 * The columns the period part of the grid draws, left to right. "mes" is one column per
 * month. Otherwise each group is a column, and a group the person opened (`expanded`) is
 * followed by its months, so a projection can still be typed there.
 */
export function buildPeriodColumns(
  periods: string[],
  grouping: PeriodGrouping,
  expanded: ReadonlySet<string> = new Set(),
): PeriodColumn[] {
  if (grouping === 'month') {
    return periods.map((period) => ({
      key: period,
      label: periodLabel(period),
      kind: 'month',
      months: [period],
    }));
  }

  const groups = new Map<string, string[]>();
  for (const period of periods) {
    const key = groupKeyOf(period, grouping);
    groups.set(key, [...(groups.get(key) ?? []), period]);
  }
  return [...groups].flatMap(([key, months]) => [
    { key, label: periodLabel(key), kind: 'group' as const, months },
    ...(expanded.has(key)
      ? months.map((month) => ({
          key: month,
          label: periodLabel(month),
          kind: 'month' as const,
          months: [month],
          within: key,
        }))
      : []),
  ]);
}
