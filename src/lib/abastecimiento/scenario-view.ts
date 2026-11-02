import type { components } from './api/schema';

type AccountDetail = components['schemas']['AccountDetail'];
type ScenarioAdjustment = components['schemas']['ScenarioAdjustment'];

export interface FlatAccountRow {
  account: AccountDetail;
  depth: number;
}

/** The account tree as an ordered list (parents before their children) with each
 * row's depth — the wireframe's split panes are flat lists, not collapsible groups. */
export function flattenAccounts(accounts: AccountDetail[], depth = 0): FlatAccountRow[] {
  return accounts.flatMap((account) => [
    { account, depth },
    ...flattenAccounts(account.children, depth + 1),
  ]);
}

/** Ids of the accounts whose real+projected total differs between the real report and
 * the scenario overlay — the rows the wireframe paints "ajustado". */
export function adjustedAccountIds(
  real: AccountDetail[],
  withScenario: AccountDetail[],
): Set<string> {
  const realById = new Map(
    flattenAccounts(real).map(({ account }) => [
      account.chartAccountId,
      account.totals.reported ?? 0,
    ]),
  );
  const adjusted = new Set<string>();
  for (const { account } of flattenAccounts(withScenario)) {
    const before = realById.get(account.chartAccountId) ?? 0;
    const after = account.totals.reported ?? 0;
    if (Math.abs(after - before) > 0.005) adjusted.add(account.chartAccountId);
  }
  return adjusted;
}

/** "2026-08" .. "2026-11" -> ["2026-08-01", ..., "2026-11-01"]; empty if the range is
 * backwards or malformed. */
export function monthsBetween(from: string, to: string): string[] {
  const pattern = /^(\d{4})-(\d{2})$/;
  const a = pattern.exec(from);
  const b = pattern.exec(to);
  if (!a || !b) return [];
  let year = Number(a[1]);
  let month = Number(a[2]);
  const endYear = Number(b[1]);
  const endMonth = Number(b[2]);
  const months: string[] = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export interface AdjustmentDiff {
  added: ScenarioAdjustment[];
  removed: ScenarioAdjustment[];
}

/** What changed between two adjustment lists, by id — a saved adjustment is immutable
 * (it is added or removed, never edited), so id membership is the whole diff. */
export function diffAdjustments(
  before: ScenarioAdjustment[],
  after: ScenarioAdjustment[],
): AdjustmentDiff {
  const beforeIds = new Set(before.map((a) => a.id));
  const afterIds = new Set(after.map((a) => a.id));
  return {
    added: after.filter((a) => !beforeIds.has(a.id)),
    removed: before.filter((a) => !afterIds.has(a.id)),
  };
}

/** The adjustments a saved version held, from its snapshot. */
export function snapshotAdjustments(snapshot: unknown): ScenarioAdjustment[] {
  const adjustments = (snapshot as { adjustments?: unknown } | null)?.adjustments;
  return Array.isArray(adjustments) ? (adjustments as ScenarioAdjustment[]) : [];
}

export interface VersionLike {
  snapshot: unknown;
}

/** Where the scenario stands against its saved history. `versions` is newest-first.
 * A scenario with no saved version is always "unsaved" (its first save is v1);
 * otherwise it is unsaved when its adjustments differ from the latest snapshot. */
export function historyState(
  versions: VersionLike[],
  currentAdjustments: ScenarioAdjustment[],
): { dirty: boolean; displayVersion: number } {
  if (versions.length === 0) return { dirty: true, displayVersion: 1 };
  const latest = snapshotAdjustments(versions[0]!.snapshot);
  const { added, removed } = diffAdjustments(latest, currentAdjustments);
  const dirty = added.length > 0 || removed.length > 0;
  return { dirty, displayVersion: dirty ? versions.length + 1 : versions.length };
}
