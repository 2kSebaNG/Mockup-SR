/** `undefined` when the award date is blank or not in the future — mirrors
 * DealsService's own check (budget-control-api): an award already happened. */
export function awardedAtError(value: string): string | undefined {
  if (!value) return undefined;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return value > localToday ? 'La fecha de adjudicación no puede ser futura.' : undefined;
}

export const AMENDMENT_TAG: Record<string, string> = {
  CHANGE_NOTICE: 'NOC',
  MODIFICATION: 'MOD',
  ADDENDUM: 'ADENDA',
};

/** Mirrors ProjectsService's own check (budget-control-api): a project can't end
 * before it starts. `undefined` when fine or either date is blank. */
export function projectDatesError(startDate: string, endDate: string): string | undefined {
  if (!startDate || !endDate) return undefined;
  return endDate < startDate ? 'La fecha de término no puede ser anterior al inicio.' : undefined;
}

/** How a deal status is worded in the screens; one this map does not know is shown as it
 * comes, so a new status is never hidden. */
export const DEAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  CLOSED: 'Cerrado',
};

export function dealStatusLabel(status: string): string {
  return DEAL_STATUS_LABEL[status] ?? status;
}

/** The projects of a deal that keep it open: every one that is not closed yet. */
export function openProjects<T extends { status: string }>(projects: T[]): T[] {
  return projects.filter((project) => project.status !== 'CLOSED');
}

/** Why a deal cannot be closed yet, or `undefined` when it can: all its projects have to be
 * closed first. Mirrors DealsService (budget-control-api), which has the last word. */
export function closeBlockText(projects: { code: string; status: string }[]): string | undefined {
  const open = openProjects(projects);
  if (open.length === 0) return undefined;
  const codes = open.map((project) => project.code).join(', ');
  return open.length === 1
    ? `Para cerrar el negocio primero hay que cerrar el proyecto ${codes}.`
    : `Para cerrar el negocio primero hay que cerrar los proyectos ${codes}.`;
}

/** What a client's card adds up from its deals. */
export function clientDealTotals(
  deals: { status: string; currentValue: number; projectCount: number }[],
): { deals: number; openDeals: number; projects: number; value: number } {
  return {
    deals: deals.length,
    openDeals: deals.filter((deal) => deal.status !== 'CLOSED').length,
    projects: deals.reduce((sum, deal) => sum + deal.projectCount, 0),
    value: deals.reduce((sum, deal) => sum + deal.currentValue, 0),
  };
}

/** What a list shows for the client of a deal; older deals may have none. */
export function clientLabel(name: string | null | undefined): string {
  return name?.trim() ? name : 'Sin cliente';
}
