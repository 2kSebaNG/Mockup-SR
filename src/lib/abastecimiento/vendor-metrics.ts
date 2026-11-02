import type { components } from './api/schema';

export type VendorMetric = components['schemas']['VendorMetric'];

/** What the metrics can be ranked by. */
export type MetricSort = 'paid' | 'orders' | 'seniority' | 'average' | 'price' | 'name';

export const SORT_LABELS: Record<MetricSort, string> = {
  name: 'Nombre',
  paid: 'Desembolsado',
  orders: 'OCs realizadas',
  average: 'Monto por OC',
  seniority: 'Antigüedad',
  price: 'Índice de precio',
};

function valueOf(metric: VendorMetric, sort: MetricSort): number | string | null {
  switch (sort) {
    case 'paid':
      return metric.paidAmount;
    case 'orders':
      return metric.ordersCount;
    case 'average':
      return metric.averageOrderAmount;
    case 'seniority':
      return metric.seniorityMonths;
    case 'price':
      return metric.priceIndex;
    case 'name':
      return metric.name;
  }
}

/**
 * The vendors ranked by one measure, highest first unless asked otherwise (names go A to Z by
 * default). A vendor without the measure (no price index) goes last whichever the direction, and
 * ties keep the vendors' own order, by name.
 */
export function sortMetrics(
  metrics: VendorMetric[],
  sort: MetricSort,
  direction: 'asc' | 'desc' = sort === 'name' ? 'asc' : 'desc',
): VendorMetric[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...metrics].sort((a, b) => {
    const left = valueOf(a, sort);
    const right = valueOf(b, sort);
    if (left === null && right === null) return a.name.localeCompare(b.name, 'es');
    if (left === null) return 1;
    if (right === null) return -1;
    const order =
      typeof left === 'string' || typeof right === 'string'
        ? String(left).localeCompare(String(right), 'es')
        : left - right;
    return order !== 0 ? sign * order : a.name.localeCompare(b.name, 'es');
  });
}

/** The `count` vendors that rank highest by a measure, leaving out those with nothing in it
 * (no money paid, no orders), which would only be empty bars. */
export function topBy(metrics: VendorMetric[], sort: Exclude<MetricSort, 'name'>, count: number) {
  return sortMetrics(metrics, sort)
    .filter((metric) => {
      const value = valueOf(metric, sort);
      return typeof value === 'number' && value > 0;
    })
    .slice(0, count);
}

/** "1 año y 8 meses", "5 meses", "menos de un mes": how long a vendor has been around. */
export function formatSeniority(months: number): string {
  if (months < 1) return 'menos de un mes';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? '1 año' : `${years} años`;
  const m = rest === 1 ? '1 mes' : `${rest} meses`;
  if (years === 0) return m;
  return rest === 0 ? y : `${y} y ${m}`;
}

/** How far a price index is from the average, as a share: 1.12 is +0.12, 0.9 is -0.1. */
export function priceDeviation(index: number): number {
  return Math.round((index - 1) * 10_000) / 10_000;
}

/** "12% sobre el promedio", "10% bajo el promedio" or "en el promedio" (within half a point). */
export function formatPriceDeviation(index: number | null | undefined): string {
  if (index === null || index === undefined) return 'sin comparables';
  const deviation = priceDeviation(index);
  const points = Math.abs(deviation) * 100;
  if (points < 0.5) return 'en el promedio';
  const text = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(points);
  return `${text}% ${deviation > 0 ? 'sobre' : 'bajo'} el promedio`;
}

/** Dearer than the others by five points or more is bad news, cheaper by as much is good. */
export function priceTone(index: number | null | undefined): 'good' | 'bad' | undefined {
  if (index === null || index === undefined) return undefined;
  const deviation = priceDeviation(index);
  if (deviation >= 0.05) return 'bad';
  if (deviation <= -0.05) return 'good';
  return undefined;
}

/** The vendors that can be compared on price, the dearest first. */
export function priceRanking(metrics: VendorMetric[]): VendorMetric[] {
  return sortMetrics(
    metrics.filter((metric) => metric.priceIndex !== null),
    'price',
  );
}

/** The `count` dearest vendors (above the average) and the `count` cheapest (at or below it) of
 * those with an index: nobody is on both sides, and the cheapest comes first on its side. */
export function dearestAndCheapest(
  metrics: VendorMetric[],
  count: number,
): { dearest: VendorMetric[]; cheapest: VendorMetric[] } {
  const ranked = priceRanking(metrics);
  return {
    dearest: ranked.filter((metric) => (metric.priceIndex ?? 0) > 1).slice(0, count),
    cheapest: ranked
      .filter((metric) => (metric.priceIndex ?? 0) <= 1)
      .slice(-count)
      .reverse(),
  };
}

/** The first day of the current year and today: what the period filter starts from. */
export function thisYear(today: Date = new Date()): { from: string; to: string } {
  const year = today.getFullYear();
  return { from: `${year}-01-01`, to: today.toISOString().slice(0, 10) };
}
