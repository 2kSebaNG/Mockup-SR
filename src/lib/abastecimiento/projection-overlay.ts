import type { components } from './api/schema';

type AccountDetail = components['schemas']['AccountDetail'];
type SummaryCell = components['schemas']['SummaryCell'];

const EMPTY: SummaryCell = { budget: null, actual: null, forecast: null, reported: null };

/** Where a typed projection lives: an account and a month. */
export function editKey(chartAccountId: string, period: string): string {
  return `${chartAccountId}|${period}`;
}

/** Null-aware, like the API's roll-up: a lone value counts the rest as 0, nothing stays null. */
function addAmounts(a: number | null, b: number | null): number | null {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

/** A node's totals are the sum of its months, as the API computes them. */
function recomputeTotals(node: AccountDetail) {
  const totals: SummaryCell = { budget: null, actual: null, forecast: null, reported: null };
  for (const cell of Object.values(node.byPeriod)) {
    totals.budget = addAmounts(totals.budget, cell.budget);
    totals.actual = addAmounts(totals.actual, cell.actual);
    totals.forecast = addAmounts(totals.forecast, cell.forecast);
    totals.reported = addAmounts(totals.reported, cell.reported);
  }
  node.totals = totals;
}

/**
 * The tree as it will be once the projections just typed have been saved, so every
 * figure that adds a cell up moves at once instead of waiting for the report to come back:
 * the group the cell is in, the groups above it, the totals and (since the grid derives it)
 * the variation. `edits` maps an account and a month (see `editKey`) to the amount typed,
 * or `null` for a cleared cell. The server's answer replaces this as soon as it arrives.
 *
 * Only a month without real can take a projection (the real wins), so an edit on a month
 * that has one changes nothing. A month the account had no figure in at all gains a cell. Returns the same array when there is nothing to apply.
 */
export function applyForecastEdits(
  accounts: AccountDetail[],
  edits: ReadonlyMap<string, number | null>,
): AccountDetail[] {
  if (edits.size === 0) return accounts;

  const tree = JSON.parse(JSON.stringify(accounts)) as AccountDetail[];
  const index = new Map<string, { node: AccountDetail; ancestors: AccountDetail[] }>();
  const walk = (node: AccountDetail, ancestors: AccountDetail[]) => {
    index.set(node.chartAccountId, { node, ancestors });
    for (const child of node.children) walk(child, [...ancestors, node]);
  };
  tree.forEach((root) => walk(root, []));

  const touched = new Set<AccountDetail>();
  for (const [key, amount] of edits) {
    const split = key.lastIndexOf('|');
    const entry = index.get(key.slice(0, split));
    const period = key.slice(split + 1);
    if (!entry) continue;
    // A month the account has no figure in yet (no budget, no real, no projection) has no
    // cell at all in the report: it starts from an empty one.
    const cell = (entry.node.byPeriod[period] ??= { ...EMPTY });
    if (cell.actual !== null) continue;

    const delta = (amount ?? 0) - (cell.forecast ?? 0);
    cell.forecast = amount;
    cell.reported = amount;
    touched.add(entry.node);

    for (const ancestor of entry.ancestors) {
      const above = (ancestor.byPeriod[period] ??= { ...EMPTY });
      // An empty group that gains a figure starts from it; one that loses its last stays 0
      // for the moment, until the report comes back.
      above.forecast = addAmounts(above.forecast, delta);
      above.reported = addAmounts(above.reported, delta);
      touched.add(ancestor);
    }
  }
  touched.forEach(recomputeTotals);
  return tree;
}
