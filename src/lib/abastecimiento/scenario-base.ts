/**
 * Which version of a project's figures the report shows, given the project's base scenario.
 *
 * The URL says it with `?escenario=`: a scenario's id, `original` for the bare original, or
 * nothing at all. Nothing means "the way the project is worked": the base scenario when the
 * project has one, otherwise the original. So a project with a base opens on it, and the
 * original stays one choice away.
 */

/** The value of `?escenario=` that asks for the bare original while the project has a base. */
export const ORIGINAL_PARAM = 'original';

/** The scenario to show: its id, or `''` for the original. */
export function resolveScenario(param: string | null, baseId: string | null): string {
  if (param === ORIGINAL_PARAM) return '';
  if (param) return param;
  return baseId ?? '';
}

/** What to put in the URL to get `scenarioId` (`''` for the original): `null` for nothing,
 * which is what the default is, so a link to the project opens the same view. */
export function paramFor(scenarioId: string, baseId: string | null): string | null {
  if (scenarioId === '') return baseId ? ORIGINAL_PARAM : null;
  if (scenarioId === baseId) return null;
  return scenarioId;
}

/** Whether the view is the one the project is worked from — the original, or the base — where
 * what is typed is a draft over it rather than a change to a scenario. */
export function isBaseView(scenarioId: string, baseId: string | null): boolean {
  return scenarioId === '' || scenarioId === baseId;
}

/** What the figures are compared with, in words: "original", or "base" when there is one. */
export function baselineWord(baseId: string | null): 'original' | 'base' {
  return baseId ? 'base' : 'original';
}

/** The text of the column that says how far a figure moved from what it is compared with. */
export function deltaLabel(word: 'original' | 'base'): string {
  return `Δ vs ${word}`;
}
