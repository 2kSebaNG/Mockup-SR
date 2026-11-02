import type { components } from './api/schema';
import { formatAmount, formatPercent, formatPeriod } from './format';

export type ProjectAlerts = components['schemas']['ProjectAlerts'];
export type ProjectAlert = components['schemas']['ProjectAlert'];
export type AlertRecommendation = components['schemas']['ProjectAlertRecommendation'];
export type AlertOutlook = components['schemas']['ProjectAlertOutlook'];
export type WatchedCell = components['schemas']['WatchedCell'];
export type AlertSeverity = 'warn' | 'critical';

/** The sentence of an alert: the API sends the rule and its figures, the words are ours. */
export function alertText(alert: ProjectAlert): string {
  const name = `«${alert.accountName ?? 'Cuenta'}»`;
  const amount = formatAmount(Math.abs(alert.amount ?? 0));
  const share = formatPercent(Math.abs(alert.percent ?? 0));
  switch (alert.rule) {
    case 'ACCOUNT_OVER_BUDGET':
      return `${name} va ${amount} sobre su presupuesto (${share} más).`;
    case 'UNBUDGETED_SPEND':
      return `${name} lleva ${amount} de gasto y no tiene presupuesto.`;
    case 'INCOME_BELOW_BUDGET':
      return `${name} proyecta ${amount} menos de lo presupuestado (${share} menos).`;
    case 'COSTS_OVER_BUDGET':
      return `Los costos del proyecto van ${amount} sobre lo presupuestado (${share} más).`;
    case 'MONTH_OVER_BUDGET':
      return `En ${alert.period ? formatPeriod(alert.period) : 'un mes'} los costos superan lo presupuestado en ${amount}.`;
    case 'PROFITABILITY_BELOW_MIN':
      return `El retorno proyectado es ${formatPercent(alert.percent)}, bajo el mínimo esperado de ${formatPercent(alert.threshold)}.`;
    case 'PROFITABILITY_NEGATIVE':
      return `El proyecto pierde plata: los costos proyectados superan las ventas en ${amount}.`;
    case 'WATCH_OVER_LIMIT':
      return `${name}${alert.period ? ` en ${formatPeriod(alert.period)}` : ''} va ${amount} sobre el tope vigilado de ${formatAmount(alert.threshold)} (${share} más).`;
    case 'WATCH_UNDER_LIMIT':
      return `${name}${alert.period ? ` en ${formatPeriod(alert.period)}` : ''} queda ${amount} bajo el mínimo vigilado de ${formatAmount(alert.threshold)} (${share} menos).`;
    default:
      return 'Hay algo que mirar en este proyecto.';
  }
}

/** The cell a watch is about, in words: the account and the month ("todo el proyecto" without one). */
export function watchTitle(watch: Pick<WatchedCell, 'accountName' | 'period'>): string {
  return `${watch.accountName} · ${watch.period ? formatPeriod(watch.period) : 'todo el proyecto'}`;
}

/** Where a watched cell stands, in a sentence: how much is in it against the limit and what that
 * means. A cost has a ceiling ("tope") and an income a floor ("mínimo"). */
export function watchText(watch: WatchedCell): string {
  if (watch.limit === null) {
    return `Sin ${watch.direction === 'MAX' ? 'tope' : 'mínimo'}: ponle uno, o dale presupuesto a esa celda.`;
  }
  const word = watch.direction === 'MAX' ? 'tope' : 'mínimo';
  const figures = `${formatAmount(watch.reported)} de ${word} ${formatAmount(watch.limit)}`;
  const gap = formatAmount(Math.abs(watch.gap ?? 0));
  switch (watch.status) {
    case 'breached':
      return watch.direction === 'MAX'
        ? `${figures}: se pasó por ${gap}.`
        : `${figures}: faltan ${gap}.`;
    case 'near':
      if (Math.abs(watch.gap ?? 0) < 0.5) {
        return `${figures}: justo en el ${word}.`;
      }
      return watch.direction === 'MAX'
        ? `${figures}: cerca del tope, quedan ${gap}.`
        : `${figures}: cerca del mínimo, sobran ${gap}.`;
    default:
      return watch.direction === 'MAX'
        ? `${figures}: quedan ${gap} de margen.`
        : `${figures}: sobran ${gap}.`;
  }
}

/** What the grid marks: the watched cells that are close to their limit or past it, by account and
 * month (`total` for the whole project). */
export function watchMarks(watches: WatchedCell[]): Record<string, 'near' | 'breached'> {
  const marks: Record<string, 'near' | 'breached'> = {};
  for (const watch of watches) {
    if (watch.status !== 'near' && watch.status !== 'breached') continue;
    marks[`${watch.chartAccountId}|${watch.period ?? 'total'}`] = watch.status;
  }
  return marks;
}

function names(recommendation: AlertRecommendation): string {
  return recommendation.accounts.map((account) => `«${account.name}»`).join(', ');
}

/** What to do about it, in a sentence. `alerts` and `outlook` say which case it is (cutting
 * costs to break even is not the same as cutting them to reach a minimum). */
export function recommendationText(
  recommendation: AlertRecommendation,
  alerts: ProjectAlert[],
  outlook: AlertOutlook,
): string {
  const amount = formatAmount(Math.abs(recommendation.amount ?? 0));
  switch (recommendation.kind) {
    case 'REVIEW_ACCOUNTS':
      return `Revisa primero ${names(recommendation)}: concentran ${amount} del sobregasto. Pide cotizar de nuevo, posterga compras que no son urgentes o reasigna presupuesto de cuentas con holgura.`;
    case 'CUT_COSTS':
      return alerts.some((alert) => alert.rule === 'PROFITABILITY_NEGATIVE')
        ? `Para dejar de perder hay que bajar ${amount} de costos o subir las ventas en ese monto. Empieza por lo que aún no se compra.`
        : `Para volver al retorno mínimo hay que bajar ${amount} de costos (o subir las ventas en ese monto). Empieza por lo que aún no se compra.`;
    case 'HEADROOM':
      return outlook.minProfitability !== null
        ? `Hay holgura: puedes gastar hasta ${amount} más antes de bajar del retorno mínimo de ${formatPercent(outlook.minProfitability)}.`
        : `Hay holgura: puedes gastar hasta ${amount} más antes de que el proyecto empiece a perder.`;
    case 'WATCH_ACCOUNTS':
      return `Mira de cerca ${names(recommendation)}: ya consumieron más del 90% de su presupuesto. Revisa su proyección antes de comprometer más.`;
    case 'REVIEW_UNBUDGETED':
      return `Hay gasto sin presupuesto en ${names(recommendation)} (${amount}). Dales presupuesto o reclasifica el gasto a la cuenta que corresponde.`;
    default:
      return 'Revisa el proyecto.';
  }
}

/** The worst severity among alerts, or `null` when there are none. */
export function worstSeverity(alerts: ProjectAlert[]): AlertSeverity | null {
  if (alerts.some((alert) => alert.severity === 'critical')) return 'critical';
  return alerts.length > 0 ? 'warn' : null;
}

interface TreeNode {
  chartAccountId: string;
  children: TreeNode[];
}

/**
 * The severity of every account in the tree, groups included: a group takes the worst of what is
 * under it (and of its own), so a collapsed group still shows that something inside is wrong.
 */
export function severityByAccount(
  accounts: TreeNode[],
  own: Record<string, AlertSeverity>,
): Record<string, AlertSeverity> {
  const result: Record<string, AlertSeverity> = {};
  const rank = (severity: AlertSeverity | undefined) =>
    severity === 'critical' ? 2 : severity === 'warn' ? 1 : 0;
  const walk = (node: TreeNode): AlertSeverity | undefined => {
    let worst: AlertSeverity | undefined = own[node.chartAccountId];
    for (const child of node.children) {
      const found = walk(child);
      if (rank(found) > rank(worst)) worst = found;
    }
    if (worst) result[node.chartAccountId] = worst;
    return worst;
  };
  accounts.forEach(walk);
  return result;
}

export interface WhatIf {
  profitability: number | null;
  /** Under the minimum return the project is expected to give (or under zero when there is none). */
  belowFloor: boolean;
  /** Pesos to cut elsewhere, or earn more, to stay at the floor after spending `extra`. */
  shortfall: number;
  /** What is left to spend after `extra`; negative when it is already past the floor. */
  headroomAfter: number | null;
}

/** "If I spend `extra` more": the return that would be left and whether it holds. */
export function whatIf(outlook: AlertOutlook, extra: number): WhatIf {
  const sales = outlook.sales;
  if (sales === null || sales <= 0) {
    return { profitability: null, belowFloor: false, shortfall: 0, headroomAfter: null };
  }
  const costs = outlook.costs + extra;
  const profitability = (sales - costs) / sales;
  const floor = outlook.minProfitability ?? 0;
  const headroomAfter = sales * (1 - floor) - costs;
  return {
    profitability,
    belowFloor: profitability < floor,
    shortfall: Math.max(0, -headroomAfter),
    headroomAfter,
  };
}

/** "12,5" or "12.5%" -> 0.125; `null` for blank or something that is not a number. */
export function percentFromInput(text: string): number | null {
  const cleaned = text.replace('%', '').trim().replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value / 100 : null;
}

/** 0.125 -> "12,5"; blank for `null`. */
export function percentToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(Math.round(value * 10_000) / 100).replace('.', ',');
}

/** "1.500.000" -> 1500000; `null` for blank or something that is not an amount. */
export function amountFromInput(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  return digits === '' ? null : Number(digits);
}

/** 1500000 -> "1.500.000"; blank for `null`. */
export function amountToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(value);
}
