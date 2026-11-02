import type { components } from './api/schema';
import { formatDate } from './format';

export type ProjectStatus = components['schemas']['ProjectStatus'];
export type LifecycleSuggestion = components['schemas']['LifecycleSuggestion'];
export type ProjectLifecycle = components['schemas']['ProjectLifecycle'];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'Activo',
  CLOSING: 'En cierre',
  CLOSED: 'Cerrado',
};

/** The badge variant of each state (see the Badge component). */
export const STATUS_VARIANT: Record<ProjectStatus, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success',
  CLOSING: 'warning',
  CLOSED: 'secondary',
};

function days(count: number): string {
  return `${count} ${count === 1 ? 'día' : 'días'}`;
}

function when(value: string | number): string {
  return formatDate(String(value).slice(0, 10));
}

/**
 * A suggestion in a sentence: why a change of state is suggested, with the figures the rule
 * found. The API sends the rule and its numbers; the words are the screen's.
 */
export function suggestionText(suggestion: LifecycleSuggestion): string {
  const p = suggestion.params;
  switch (suggestion.rule) {
    case 'END_DATE_PASSED':
      return `La fecha de término (${when(p["endDate"]!)}) pasó hace ${days(Number(p["daysAgo"]))}.`;
    case 'END_DATE_NEAR':
      return Number(p["daysLeft"]) === 0
        ? `La fecha de término (${when(p["endDate"]!)}) es hoy.`
        : `Faltan ${days(Number(p["daysLeft"]))} para la fecha de término (${when(p["endDate"]!)}).`;
    case 'BUDGET_CONSUMED':
      return `Lleva gastado el ${p["percent"]}% del presupuesto (real + proyectado).`;
    case 'NO_ACTIVITY':
      return `Lleva ${days(Number(p["days"]))} sin movimientos.`;
    case 'ASSIGNMENTS_ENDED':
      return `Todo el personal asignado (${p["assignments"]}) ya terminó.`;
    case 'NOTHING_PENDING':
      return `No quedan órdenes de compra ni rendiciones pendientes y lleva ${days(Number(p["days"]))} en cierre.`;
    case 'END_DATE_LONG_PASSED':
      return `La fecha de término (${when(p["endDate"]!)}) pasó hace ${days(Number(p["daysAgo"]))}.`;
    case 'ACTIVITY_AFTER_CLOSE':
      return `Hubo ${Number(p["movements"])} ${Number(p["movements"]) === 1 ? 'movimiento' : 'movimientos'} después del cierre.`;
    default:
      return 'Hay una razón para cambiar el estado.';
  }
}

/** What accepting a suggestion does, as a button says it: "Pasar a En cierre", "Reabrir". */
export function suggestionAction(suggestion: LifecycleSuggestion): string {
  return suggestion.to === 'ACTIVE' ? 'Reabrir' : `Pasar a ${STATUS_LABEL[suggestion.to]}`;
}

/** Who or what made a change of state, in a few words. */
export function triggerText(change: {
  trigger: 'MANUAL' | 'SUGGESTION' | 'AUTO';
  changedByName: string | null;
}): string {
  if (change.trigger === 'AUTO') return 'Automático (regla segura)';
  const by = change.changedByName ?? 'alguien';
  return change.trigger === 'SUGGESTION' ? `${by}, aceptando una sugerencia` : by;
}

/** Whether going from one state to another is reopening what was closed, which asks for a note. */
export function needsNote(from: ProjectStatus, to: ProjectStatus): boolean {
  return from === 'CLOSED' && to !== 'CLOSED';
}
