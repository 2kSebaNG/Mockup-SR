import type { components } from './api/schema';

type PersonAssignment = components['schemas']['PersonAssignment'];

export type PayrollAssignment = Pick<
  PersonAssignment,
  'employerCost' | 'startDate' | 'endDate' | 'contrato'
>;

function monthIndex(isoDate: string): number {
  const [year, month] = isoDate.slice(0, 10).split('-').map(Number);
  return year! * 12 + (month! - 1);
}

/** Calendar months touched from `start` through `end`, both inclusive — the same
 * rule the backend uses to generate one payroll row per active month. */
export function monthsInclusive(start: string, end: string): number {
  return Math.max(0, monthIndex(end) - monthIndex(start) + 1);
}

/** Still on the payroll today: no end date yet, or one that hasn't passed. */
export function isActiveAssignment(assignment: Pick<PayrollAssignment, 'endDate'>, today: string) {
  return !assignment.endDate || assignment.endDate >= today;
}

/**
 * Employer cost over the whole assignment: through its own end date, otherwise the
 * contrato's planned end, otherwise its project's. `null` when none of those is known
 * — a projection is never invented from a guessed horizon (section 2.3c). Office
 * staff (no contrato) fall straight to `null` unless they have their own end date.
 * Severance is a one-off and not part of this monthly-cost projection.
 */
export function projectedTotal(assignment: PayrollAssignment): number | null {
  const end =
    assignment.endDate ?? assignment.contrato?.endDate ?? assignment.contrato?.project?.endDate;
  if (!end) return null;
  return assignment.employerCost * monthsInclusive(assignment.startDate, end);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}
