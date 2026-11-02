import type { ProjectStatus } from './lifecycle';

const STATUSES: ProjectStatus[] = ['ACTIVE', 'CLOSING', 'CLOSED'];

/** The state filter of the "Proyectos" table from the URL: one of the three, or none. */
export function parseProjectStatus(value: string): ProjectStatus | undefined {
  return STATUSES.find((status) => status === value);
}

/** The dates of a project as one cell: "—" for a project with neither. */
export function projectSpan(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  formatDate: (date: string) => string,
): string {
  if (!startDate && !endDate) return '—';
  return `${startDate ? formatDate(startDate) : '—'} — ${endDate ? formatDate(endDate) : '—'}`;
}

/** What the project's unit is edited to from the select: "" is none. */
export function unitPatch(selected: string): string | null {
  return selected === '' ? null : selected;
}
