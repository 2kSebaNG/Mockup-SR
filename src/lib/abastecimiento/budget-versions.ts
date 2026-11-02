import type { components } from './api/schema';
import { formatDisplayAmount } from './format';

type Account = components['schemas']['BudgetVersionAccount'];

export interface BudgetTreeNode {
  account: Account;
  /** Own amounts plus every descendant's, per version label. */
  amounts: Record<string, number>;
  /** Own real plus every descendant's; null when nothing in the subtree has any. */
  actual: number | null;
  children: BudgetTreeNode[];
}

/** Builds the account tree (roots first, by code) with each node's totals rolled up
 * from its descendants — the wireframe's "group head" rows are these roll-ups. An
 * account whose parent has no row of its own in the list is treated as a root. */
export function buildBudgetTree(accounts: Account[]): BudgetTreeNode[] {
  const byId = new Map(accounts.map((a) => [a.chartAccountId, a]));
  const childrenOf = new Map<string, Account[]>();
  const roots: Account[] = [];

  for (const account of accounts) {
    if (account.parentAccountId && byId.has(account.parentAccountId)) {
      const siblings = childrenOf.get(account.parentAccountId) ?? [];
      siblings.push(account);
      childrenOf.set(account.parentAccountId, siblings);
    } else {
      roots.push(account);
    }
  }

  const byCode = (a: Account, b: Account) =>
    a.code.localeCompare(b.code, undefined, { numeric: true });

  function build(account: Account): BudgetTreeNode {
    const children = (childrenOf.get(account.chartAccountId) ?? []).sort(byCode).map(build);
    const amounts = { ...account.amounts };
    let actual = account.actual;
    for (const child of children) {
      for (const [version, amount] of Object.entries(child.amounts)) {
        amounts[version] = (amounts[version] ?? 0) + amount;
      }
      if (child.actual !== null) actual = (actual ?? 0) + child.actual;
    }
    return { account, amounts, actual, children };
  }

  return roots.sort(byCode).map(build);
}

/** A budget figure as this screen shows it: whole on a wide one, short ("$1.402M") on a phone. */
export const formatBudgetAmount = formatDisplayAmount;

/** Change from the first version to the current one, as a fraction; null when there is
 * no baseline (0 or missing) to divide by. */
export function versionDelta(
  amounts: Record<string, number>,
  firstVersion: string | undefined,
  currentVersion: string | null,
): number | null {
  if (!firstVersion || !currentVersion) return null;
  const base = amounts[firstVersion];
  const current = amounts[currentVersion];
  if (!base || current === undefined) return null;
  return (current - base) / base;
}

/** "+4,5%" / "-2,0%" / "0,0%" — the sign is explicit so a rise reads as a rise. */
export function formatSignedPercent(value: number | null): string {
  if (value === null) return '—';
  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return value > 0 ? `+${formatted}` : formatted;
}
