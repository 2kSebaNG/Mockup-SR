/** An account as the picker is given it. */
export interface AccountOption {
  id: string;
  code?: string | null | undefined;
  name: string;
  parentAccountId?: string | null | undefined;
}

/** An account in its place in the tree. */
export interface AccountRow extends AccountOption {
  /** How deep it sits: 0 for a root. */
  depth: number;
  /** Where it is, from the top: "Costos directos › Arriendo › Equipos". */
  path: string;
  /** Whether it has accounts under it. */
  isGroup: boolean;
}

/** Lowercase, without accents, one space between words: how what is typed and what is searched are
 * made comparable. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function byCode(a: AccountOption, b: AccountOption): number {
  return (
    (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * The accounts in the order of the tree — each group followed by what is under it, siblings by
 * code — with each one's depth and path. An account whose parent is not among those given counts
 * as a root, so a list cut down (the accounts of one report) still reads as a tree.
 */
export function accountRows(options: AccountOption[]): AccountRow[] {
  const known = new Set(options.map((option) => option.id));
  const children = new Map<string | null, AccountOption[]>();
  for (const option of options) {
    const parent =
      option.parentAccountId && known.has(option.parentAccountId) ? option.parentAccountId : null;
    children.set(parent, [...(children.get(parent) ?? []), option]);
  }
  const rows: AccountRow[] = [];
  const visit = (parent: string | null, depth: number, trail: string[]) => {
    for (const option of [...(children.get(parent) ?? [])].sort(byCode)) {
      const path = [...trail, option.name];
      rows.push({ ...option, depth, path: path.join(' › '), isGroup: children.has(option.id) });
      visit(option.id, depth + 1, path);
    }
  };
  visit(null, 0, []);
  return rows;
}

/**
 * The accounts that match what was typed: every word of it has to be in the account's code or in
 * its path, so "arriendo equipos" finds "Equipos" under "Arriendo", and "arriendo" finds the group
 * and everything under it. Nothing typed is everything, in the order of the tree.
 */
export function filterAccounts(rows: AccountRow[], query: string): AccountRow[] {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter((row) => {
    const haystack = normalizeSearch(`${row.code ?? ''} ${row.path}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** How an account is written where it is chosen or shown: its code and name. */
export function accountLabel(account: Pick<AccountOption, 'code' | 'name'>): string {
  return account.code ? `${account.code} — ${account.name}` : account.name;
}

/** The accounts of a report (a tree whose nodes carry their children) as a flat list of options. */
export function flattenAccounts(
  nodes: {
    chartAccountId: string;
    code?: string | null;
    name: string;
    parentAccountId?: string | null;
    children: unknown[];
  }[],
): AccountOption[] {
  return nodes.flatMap((node) => [
    {
      id: node.chartAccountId,
      code: node.code,
      name: node.name,
      parentAccountId: node.parentAccountId,
    },
    ...flattenAccounts(node.children as Parameters<typeof flattenAccounts>[0]),
  ]);
}
