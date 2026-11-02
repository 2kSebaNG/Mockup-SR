import { formatPercent } from './format';

/** What the return is called wherever it is shown. */
export const RETURN_LABEL = 'Retorno proyectado';

/** What the real-only return says, for the help of the projected one. */
export function returnToDateText(toDate: number | null | undefined): string {
  return toDate === null || toDate === undefined
    ? 'A la fecha (solo lo real): todavía no hay ventas.'
    : `A la fecha (solo lo real): ${formatPercent(toDate)}.`;
}

/**
 * The help of the return: how it is made, and the real-only return next to it, which is what has
 * been sold and paid so far and not what the project is expected to give.
 */
export function returnHelp(toDate: number | null | undefined): string {
  return `${RETURN_LABEL}: (ventas − costos) / ventas, con lo real donde existe y la proyección donde no. ${returnToDateText(toDate)}`;
}
