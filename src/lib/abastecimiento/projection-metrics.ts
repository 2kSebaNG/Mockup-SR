import { variance, type GridView } from './projection-grid';
import type { components } from './api/schema';

type SummaryCell = components['schemas']['SummaryCell'];

/** What a month can show. Several can be on at once, each as its own column of the month,
 * so Presupuesto, Real and Proyectado sit side by side. Same names as `GridView`, plus
 * "delta": how far a scenario moved the month from the original, which only exists while a
 * scenario is on screen; and "share", what part of its group an account is. */
export type GridMetric = GridView | 'delta' | 'share';

/** The left-to-right order the columns of a month always take, and the headers of the table with
 * them: Presupuesto, Real + Proyectado, Variación, then the parts of it, Real and Proyectado. */
const METRIC_ORDER: GridMetric[] = [
  'budget',
  'reported',
  'variance',
  'actual',
  'forecast',
  'share',
  'delta',
];

export const METRIC_CHIPS: { key: GridMetric; label: string; hint?: string }[] = [
  { key: 'budget', label: 'Presupuesto' },
  { key: 'reported', label: 'Real + Proyectado' },
  { key: 'variance', label: 'Variación' },
  { key: 'actual', label: 'Real' },
  { key: 'forecast', label: 'Proyectado' },
  {
    key: 'share',
    label: '% del grupo',
    hint: 'Qué parte del total de su grupo de cuentas es esta cuenta (Real + Proyectado del mes).',
  },
];

/** The extra chip a scenario adds: the month's change against the original. */
export const DELTA_CHIP: { key: GridMetric; label: string } = {
  key: 'delta',
  label: 'Δ vs original',
};

/** Presupuesto, Real and Proyectado side by side: the comparison of a month at a glance. */
export const COMPARE_METRICS: GridMetric[] = ['budget', 'actual', 'forecast'];

/** What the person picked, in the order the grid draws it, with nothing repeated. An empty
 * pick is the IC view, never an empty grid. */
export function orderMetrics(selected: GridMetric[]): GridMetric[] {
  const ordered = METRIC_ORDER.filter((metric) => selected.includes(metric));
  return ordered.length > 0 ? ordered : ['reported'];
}

/** Turns one on or off. The last one on cannot be turned off: a month with no column makes
 * no sense. */
export function toggleMetric(selected: GridMetric[], metric: GridMetric): GridMetric[] {
  if (selected.includes(metric)) {
    return selected.length === 1 ? selected : selected.filter((m) => m !== metric);
  }
  return orderMetrics([...selected, metric]);
}

const SHORT_LABEL: Record<GridMetric, string> = {
  budget: 'Presup.',
  actual: 'Real',
  forecast: 'Proy.',
  reported: 'Real+Proy.',
  variance: 'Var.',
  share: '% grupo',
  delta: 'Δ orig.',
};

export function metricShortLabel(metric: GridMetric): string {
  return SHORT_LABEL[metric];
}

/** The month column a projection can be typed into: the projection itself when it is on
 * screen, otherwise the real-or-projected one (where a cell without real is the projection).
 * `null` when neither is shown, so nothing can be edited. */
export function editableMetric(metrics: GridMetric[]): 'forecast' | 'reported' | null {
  if (metrics.includes('forecast')) return 'forecast';
  if (metrics.includes('reported')) return 'reported';
  return null;
}

export interface SummaryColumn {
  id: string;
  label: string;
}

/** The columns before the months, in the order of the months' own: Presupuesto, the total
 * reported and the variation are always there; the total real and the total projected follow
 * when their months are on, and under a scenario (`withDelta`) so does the total change against
 * the original. */
export function summaryColumns(
  metrics: GridMetric[],
  withDelta = false,
  deltaTitle = 'Δ vs original',
): SummaryColumn[] {
  return [
    { id: 'sum:budget', label: 'Presupuesto' },
    { id: 'sum:reported', label: 'Real + Proyectado' },
    { id: 'sum:variance', label: 'Variación' },
    ...(metrics.includes('actual') ? [{ id: 'sum:actual', label: 'Total real' }] : []),
    ...(metrics.includes('forecast') ? [{ id: 'sum:forecast', label: 'Total proyectado' }] : []),
    ...(withDelta ? [{ id: 'sum:delta', label: deltaTitle }] : []),
  ];
}

/** The figure a summary column shows for a row's totals (the change against the original
 * is not in the cell: see `deltaVsOriginal`). */
export function summaryValue(total: SummaryCell, id: string): number | null {
  switch (id) {
    case 'sum:budget':
      return total.budget;
    case 'sum:actual':
      return total.actual;
    case 'sum:forecast':
      return total.forecast;
    case 'sum:variance':
      return variance(total);
    default:
      return total.reported;
  }
}
