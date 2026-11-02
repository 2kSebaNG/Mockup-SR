/**
 * The business unit a new project is given. A unit is optional: with one unit in the company there
 * is nothing to choose (the project gets it), with none the project has none, and with several the
 * person may pick one or leave it out.
 */
export function unitForNewProject(units: { id: string }[], chosen: string): string | undefined {
  if (units.length === 1) return units[0]!.id;
  // Only one that is still offered: a unit chosen and then deactivated is no longer one.
  return units.some((unit) => unit.id === chosen) ? chosen : undefined;
}

/** Whether there is anything to choose: more than one unit. */
export function hasUnitChoice(units: { id: string }[]): boolean {
  return units.length > 1;
}

/** What a list shows for the unit of a project: its name, or a dash when it has none. */
export function unitLabel(name: string | null | undefined): string {
  return name?.trim() ? name : '—';
}
