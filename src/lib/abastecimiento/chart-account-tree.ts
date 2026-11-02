interface ChartAccountLike {
  id: string;
  code: string;
  name: string;
  parentAccountId: string | null;
}

export interface ChartAccountTreeNode<A extends ChartAccountLike> {
  account: A;
  children: ChartAccountTreeNode<A>[];
}

/** Builds the parent/child tree from the flat list the API returns — root accounts
 * (`parentAccountId: null`, or pointing at an id not in this list) come first, each
 * recursively holding its own children, sorted by code within each level. */
export function buildChartAccountTree<A extends ChartAccountLike>(
  accounts: A[],
): ChartAccountTreeNode<A>[] {
  const byId = new Map<string, ChartAccountTreeNode<A>>(
    accounts.map((account) => [account.id, { account, children: [] }]),
  );
  const roots: ChartAccountTreeNode<A>[] = [];
  for (const node of byId.values()) {
    const parent = node.account.parentAccountId ? byId.get(node.account.parentAccountId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Numeric collation, so "1.2" sorts before "1.10" now that codes are correlativos.
  const sortByCode = (a: ChartAccountTreeNode<A>, b: ChartAccountTreeNode<A>) =>
    a.account.code.localeCompare(b.account.code, undefined, { numeric: true });
  const sortTree = (nodes: ChartAccountTreeNode<A>[]) => {
    nodes.sort(sortByCode);
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

/** Depth-first, pre-order flatten — a parent row always comes immediately before its
 * children, for rendering an indented tree as a flat list of rows. */
export function flattenChartAccountTree<A extends ChartAccountLike>(
  nodes: ChartAccountTreeNode<A>[],
  depth = 0,
): { account: A; depth: number }[] {
  return nodes.flatMap((node) => [
    { account: node.account, depth },
    ...flattenChartAccountTree(node.children, depth + 1),
  ]);
}

/** Ids of an account and everything below it: the accounts it cannot be moved under,
 * since that would put it inside itself. */
export function chartAccountSubtreeIds(accounts: ChartAccountLike[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const account of accounts) {
      if (account.parentAccountId && ids.has(account.parentAccountId) && !ids.has(account.id)) {
        ids.add(account.id);
        grew = true;
      }
    }
  }
  return ids;
}

export type ChartAccountDropZone = 'before' | 'inside' | 'after';

/** Where a pointer is over a row, from 0 (top edge) to 1 (bottom edge): the top and
 * bottom quarters mean "next to it" (before/after), the middle half means "inside it". */
export function resolveDropZone(fraction: number): ChartAccountDropZone {
  if (fraction < 0.25) return 'before';
  if (fraction > 0.75) return 'after';
  return 'inside';
}

export type ChartAccountDropTarget =
  { kind: 'row'; id: string; zone: ChartAccountDropZone } | { kind: 'root' };

/** A resolved move: the account goes under `parentId` (`null` = top level) at `position`
 * among that parent's other children (0-based, not counting the moved account) — the
 * same shape PATCH /chart-accounts/:id takes. */
export interface ChartAccountMove {
  parentId: string | null;
  position: number;
}

const byCode = (a: ChartAccountLike, b: ChartAccountLike) =>
  a.code.localeCompare(b.code, undefined, { numeric: true });

/**
 * What dropping `movingId` on `target` would do, or `null` when it is not a real move:
 * onto itself or anything in its own subtree (that would put it inside itself), or to
 * the place it already occupies. A row's middle makes the account its child (last); its
 * top edge puts it just before that row, among that row's siblings; its bottom edge puts
 * it just after — except on a row that has children, where the bottom edge sits visually
 * between the row and its first child, so it means "first child". `root` is the end of
 * the top level.
 */
export function resolveChartAccountMove(
  accounts: ChartAccountLike[],
  movingId: string,
  target: ChartAccountDropTarget,
): ChartAccountMove | null {
  const moving = accounts.find((account) => account.id === movingId);
  if (!moving) return null;
  const siblingsOf = (parentId: string | null) =>
    accounts
      .filter((account) => account.parentAccountId === parentId && account.id !== movingId)
      .sort(byCode);

  let move: ChartAccountMove;
  if (target.kind === 'root') {
    move = { parentId: null, position: siblingsOf(null).length };
  } else {
    const row = accounts.find((account) => account.id === target.id);
    if (!row || chartAccountSubtreeIds(accounts, movingId).has(row.id)) return null;
    const hasChildren = accounts.some((account) => account.parentAccountId === row.id);
    if (target.zone === 'inside') {
      move = { parentId: row.id, position: siblingsOf(row.id).length };
    } else if (target.zone === 'after' && hasChildren) {
      move = { parentId: row.id, position: 0 };
    } else {
      const siblings = siblingsOf(row.parentAccountId);
      const index = siblings.findIndex((account) => account.id === row.id);
      move = {
        parentId: row.parentAccountId,
        position: target.zone === 'before' ? index : index + 1,
      };
    }
  }

  const currentPosition = siblingsOf(moving.parentAccountId).filter(
    (account) => byCode(account, moving) < 0,
  ).length;
  if (move.parentId === moving.parentAccountId && move.position === currentPosition) return null;
  return move;
}

/** The confirmation sentence for a move, e.g. «Mover «1.2 · Caja» bajo «3 · Gastos», a la
 * posición 2 de 4.» — what the user is about to do, in terms of the accounts they see. */
export function describeChartAccountMove(
  accounts: ChartAccountLike[],
  movingId: string,
  move: ChartAccountMove,
): string {
  const moving = accounts.find((account) => account.id === movingId);
  if (!moving) return '';
  const label = (account: ChartAccountLike) => `«${account.code} · ${account.name}»`;
  const parent = accounts.find((account) => account.id === move.parentId);
  const total =
    accounts.filter(
      (account) => account.parentAccountId === move.parentId && account.id !== movingId,
    ).length + 1;
  const sameParent = move.parentId === moving.parentAccountId;
  const where = sameParent
    ? parent
      ? `dentro de ${label(parent)}`
      : 'dentro del nivel raíz'
    : parent
      ? `bajo ${label(parent)}`
      : 'al nivel raíz';
  return `Mover ${label(moving)} ${where}, a la posición ${move.position + 1} de ${total}.`;
}
