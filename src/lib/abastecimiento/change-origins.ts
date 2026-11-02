import type { components } from './api/schema';

type AccountDetail = components['schemas']['AccountDetail'];

/** A cell somebody changed, as opposed to the ones that moved only because it did. */
export interface ChangeOrigin {
  chartAccountId: string;
  accountName: string;
  period: string;
  /** How much it moved the figure reported there (Real + Proyectado). */
  delta: number;
}

/** Below this many pesos a difference is rounding, not a change. */
const MATERIAL = 0.5;

/**
 * The cells that were changed directly — the ones whose figure differs from the original
 * by more than their children's changes explain — out of everything that differs, which
 * also holds every group and total those cells add up into. A group moves because a
 * child did; a child moves because somebody typed it (in a draft) or a scenario adjusted
 * it. Works the same for both, from the figures alone.
 */
export function changeOrigins(
  view: AccountDetail[],
  baseline: ReadonlyMap<string, AccountDetail>,
  periods: string[],
): ChangeOrigin[] {
  const origins: ChangeOrigin[] = [];

  /** How far the account (children included) moved in a month. */
  const walk = (account: AccountDetail, period: string): number => {
    const now = account.byPeriod[period]?.reported ?? 0;
    const before = baseline.get(account.chartAccountId)?.byPeriod[period]?.reported ?? 0;
    const moved = now - before;
    const children = account.children.reduce((sum, child) => sum + walk(child, period), 0);
    const own = moved - children;
    if (Math.abs(own) >= MATERIAL) {
      origins.push({
        chartAccountId: account.chartAccountId,
        accountName: account.name,
        period,
        delta: own,
      });
    }
    return moved;
  };

  for (const period of periods) view.forEach((root) => walk(root, period));
  return origins.sort(
    (a, b) => a.period.localeCompare(b.period) || a.accountName.localeCompare(b.accountName),
  );
}

/** The ids of an account and everything under it. */
export function subtreeIds(account: AccountDetail): Set<string> {
  const ids = new Set<string>();
  const walk = (node: AccountDetail) => {
    ids.add(node.chartAccountId);
    node.children.forEach(walk);
  };
  walk(account);
  return ids;
}

/** The origins of the changes behind a figure: those in the accounts it covers and the
 * months it covers. */
export function originsIn(
  origins: ChangeOrigin[],
  accountIds: ReadonlySet<string>,
  months: string[],
): ChangeOrigin[] {
  return origins.filter(
    (origin) => accountIds.has(origin.chartAccountId) && months.includes(origin.period),
  );
}
