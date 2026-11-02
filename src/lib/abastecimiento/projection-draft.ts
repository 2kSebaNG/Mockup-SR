/**
 * Changes typed over the project's own projection that are not saved anywhere yet: a draft.
 * The grid shows them in place of the original (and highlights them), and from the draft the
 * person decides what they become — a new scenario, or the project's projection itself — or
 * drops them. A draft maps a cell (`editKey` of an account and a month) to the amount typed,
 * or `null` for a cell that was emptied.
 */
export type Draft = ReadonlyMap<string, number | null>;

/**
 * The draft after one more cell was typed. What is typed over a cell that already holds that
 * very figure is not a change, so it leaves the draft (a cell changed and then put back
 * disappears from it); anything else sets the cell, replacing what was there.
 * `original` is what the project's projection holds for that cell right now.
 */
export function withDraftCell(
  draft: Draft,
  key: string,
  amount: number | null,
  original: number | null,
): Draft {
  const next = new Map(draft);
  if (amount === original) next.delete(key);
  else next.set(key, amount);
  return next;
}

/**
 * The draft after several cells were set at once (what "Crear proyección" hands over): each one
 * as `withDraftCell` would take it, so a cell that ends up holding what the project already has is
 * not a change. `originalOf` is what the project's projection holds for a cell right now.
 */
export function withDraftChanges(
  draft: Draft,
  changes: { chartAccountId: string; period: string; amount: number | null }[],
  originalOf: (chartAccountId: string, period: string) => number | null,
): Draft {
  return changes.reduce(
    (next, change) =>
      withDraftCell(
        next,
        `${change.chartAccountId}|${change.period}`,
        change.amount,
        originalOf(change.chartAccountId, change.period),
      ),
    draft,
  );
}

/** One cell of a draft, split back into its account and month. */
export interface DraftCell {
  chartAccountId: string;
  period: string;
  /** `null` for a cell that was emptied. */
  amount: number | null;
}

export function draftCells(draft: Draft): DraftCell[] {
  return [...draft].map(([key, amount]) => {
    const split = key.lastIndexOf('|');
    return { chartAccountId: key.slice(0, split), period: key.slice(split + 1), amount };
  });
}

/** The cells of a draft as a scenario holds them: what each one reads under it. A scenario
 * has no "empty": a cell that was emptied reads 0 there. */
export function scenarioCells(
  draft: Draft,
): { chartAccountId: string; period: string; amount: number }[] {
  return draftCells(draft).map((cell) => ({ ...cell, amount: cell.amount ?? 0 }));
}

/** "3 cambios", "1 cambio". */
export function changesLabel(count: number): string {
  return `${count} ${count === 1 ? 'cambio' : 'cambios'}`;
}

/** A name for the scenario a draft becomes, ready to be edited: "Escenario 5 oct". */
export function suggestedScenarioName(date: Date = new Date()): string {
  const day = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' })
    .format(date)
    .replace('.', '');
  return `Escenario ${day}`;
}
