import type { components } from './api/schema';

export type TaxRate = components['schemas']['TaxRate'];
export type TaxRateKind = components['schemas']['TaxRateKind'];
export type CurrentTaxRates = components['schemas']['CurrentTaxRates'];

export const TAX_KINDS: TaxRateKind[] = ['IVA', 'HONORARIOS_RETENTION'];

export const TAX_LABELS: Record<TaxRateKind, string> = {
  IVA: 'IVA',
  HONORARIOS_RETENTION: 'Retención de honorarios',
};

/** What each tax is for, in a line under its name. */
export const TAX_NOTES: Record<TaxRateKind, string> = {
  IVA: 'Se suma al neto de cada orden de compra.',
  HONORARIOS_RETENTION:
    'Se descuenta antes del IVA en las órdenes con modalidad Boleta de honorarios. La ley la sube cada año hasta 2028.',
};

/** The modality whose orders carry the retention. */
export const HONORARIOS_MODALITY = 'Boleta de honorarios';

export function carriesRetention(modality: string | null | undefined): boolean {
  return modality === HONORARIOS_MODALITY;
}

/** "19", "15,25": a percent as it is read, with a comma and no useless zeros. */
export function formatRate(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return '—';
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(percent)}%`;
}

/** The rates of one tax, the most recent first. */
export function ratesOf(rates: TaxRate[], kind: TaxRateKind): TaxRate[] {
  return rates
    .filter((rate) => rate.kind === kind)
    .sort((a, b) => (a.validFrom < b.validFrom ? 1 : a.validFrom > b.validFrom ? -1 : 0));
}

/** The rate in force on a day: the latest that started on or before it. */
export function rateInForce(rates: TaxRate[], kind: TaxRateKind, date: string): TaxRate | null {
  return ratesOf(rates, kind).find((rate) => rate.validFrom <= date) ?? null;
}

/** The first rate of a tax is the one that covers the days before the next: it keeps its day and
 * cannot be removed (the API refuses both). */
export function isFirstOfKind(rate: TaxRate, rates: TaxRate[]): boolean {
  const own = ratesOf(rates, rate.kind);
  return own.length > 0 && own[own.length - 1]!.id === rate.id;
}

/** What an order made on a day applies, from the rates in force that day: the IVA, and the
 * retention only when its modality carries one. */
export function taxesOfOrder(
  rates: Pick<CurrentTaxRates, 'iva' | 'honorariosRetention'> | undefined,
  modality: string | null | undefined,
): { ivaPercent: number | null; withholdingTaxPercent: number | null } {
  return {
    ivaPercent: rates?.iva ?? null,
    withholdingTaxPercent: carriesRetention(modality) ? (rates?.honorariosRetention ?? null) : null,
  };
}

export interface TaxRateFormValues {
  validFrom: string;
  /** As typed: with a comma or a point. */
  percent: string;
}

/** "15,25" or "15.25" -> 15.25; NaN when it is not a number. */
export function parsePercent(text: string): number {
  const normalized = text.trim().replace('%', '').replace(',', '.');
  return normalized === '' ? NaN : Number(normalized);
}

/** What is wrong with a rate being entered, in words: nothing when it can be saved. */
export function taxRateProblems(values: TaxRateFormValues): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.validFrom))
    problems.push('Falta la fecha desde la que rige.');
  const percent = parsePercent(values.percent);
  if (Number.isNaN(percent)) problems.push('Falta el porcentaje.');
  else if (percent < 0 || percent > 100)
    problems.push('El porcentaje tiene que estar entre 0 y 100.');
  else if (Math.round(percent * 100) / 100 !== percent) {
    problems.push('El porcentaje admite hasta dos decimales.');
  }
  return problems;
}
