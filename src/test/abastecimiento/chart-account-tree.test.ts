import {
  buildChartAccountTree,
  chartAccountSubtreeIds,
  describeChartAccountMove,
  flattenChartAccountTree,
  resolveChartAccountMove,
  resolveDropZone,
} from '@/lib/abastecimiento/chart-account-tree';

interface Account {
  id: string;
  code: string;
  name: string;
  parentAccountId: string | null;
}

function account(id: string, code: string, parentAccountId: string | null = null): Account {
  return { id, code, name: `Account ${code}`, parentAccountId };
}

describe('buildChartAccountTree', () => {
  it('nests children under their parent', () => {
    const accounts = [account('a', '1'), account('b', '1.1', 'a'), account('c', '1.2', 'a')];
    const tree = buildChartAccountTree(accounts);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.account.id).toBe('a');
    expect(tree[0]!.children.map((c) => c.account.id)).toEqual(['b', 'c']);
  });

  it('treats an account whose parent is missing from the list as a root', () => {
    const accounts = [account('b', '1.1', 'ghost-parent')];
    const tree = buildChartAccountTree(accounts);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.account.id).toBe('b');
  });

  it('sorts siblings by code at every depth', () => {
    const accounts = [
      account('root', '1'),
      account('z', '1.9', 'root'),
      account('a', '1.1', 'root'),
    ];
    const tree = buildChartAccountTree(accounts);

    expect(tree[0]!.children.map((c) => c.account.id)).toEqual(['a', 'z']);
  });

  it('supports multiple levels of nesting', () => {
    const accounts = [account('a', '1'), account('b', '1.1', 'a'), account('c', '1.1.1', 'b')];
    const tree = buildChartAccountTree(accounts);

    expect(tree[0]!.children[0]!.children[0]!.account.id).toBe('c');
  });
});

describe('flattenChartAccountTree', () => {
  it('lists parents immediately before their children, with the right depth', () => {
    const accounts = [account('a', '1'), account('b', '1.1', 'a'), account('c', '1.2', 'a')];
    const rows = flattenChartAccountTree(buildChartAccountTree(accounts));

    expect(rows.map((r) => [r.account.id, r.depth])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 1],
    ]);
  });

  it('returns an empty list for an empty tree', () => {
    expect(flattenChartAccountTree([])).toEqual([]);
  });
});

describe('numeric code ordering', () => {
  it('sorts 1.2 before 1.10, not as plain text', () => {
    const accounts = [
      account('root', '1'),
      account('ten', '1.10', 'root'),
      account('two', '1.2', 'root'),
    ];
    expect(buildChartAccountTree(accounts)[0]!.children.map((c) => c.account.id)).toEqual([
      'two',
      'ten',
    ]);
  });
});

describe('chartAccountSubtreeIds', () => {
  const accounts = [
    account('a', '1'),
    account('a1', '1.1', 'a'),
    account('a11', '1.1.1', 'a1'),
    account('b', '2'),
  ];

  it('includes the account itself and every level below it', () => {
    expect(chartAccountSubtreeIds(accounts, 'a')).toEqual(new Set(['a', 'a1', 'a11']));
  });

  it('is just the account for a leaf', () => {
    expect(chartAccountSubtreeIds(accounts, 'b')).toEqual(new Set(['b']));
  });
});

describe('resolveDropZone', () => {
  it('reads the top quarter of a row as before, the bottom quarter as after, the rest as inside', () => {
    expect(resolveDropZone(0)).toBe('before');
    expect(resolveDropZone(0.24)).toBe('before');
    expect(resolveDropZone(0.25)).toBe('inside');
    expect(resolveDropZone(0.5)).toBe('inside');
    expect(resolveDropZone(0.75)).toBe('inside');
    expect(resolveDropZone(0.76)).toBe('after');
    expect(resolveDropZone(1)).toBe('after');
  });
});

describe('resolveChartAccountMove', () => {
  // 1 (1.1, 1.2), 2, 3 (3.1)
  const accounts = [
    account('a', '1'),
    account('a1', '1.1', 'a'),
    account('a2', '1.2', 'a'),
    account('b', '2'),
    account('c', '3'),
    account('c1', '3.1', 'c'),
  ];
  const row = (id: string, zone: 'before' | 'inside' | 'after') =>
    ({ kind: 'row', id, zone }) as const;

  it('makes the account the last child of the row it is dropped inside', () => {
    expect(resolveChartAccountMove(accounts, 'b', row('a', 'inside'))).toEqual({
      parentId: 'a',
      position: 2,
    });
  });

  it('puts it just before a row, among that row siblings', () => {
    expect(resolveChartAccountMove(accounts, 'c', row('a', 'before'))).toEqual({
      parentId: null,
      position: 0,
    });
    expect(resolveChartAccountMove(accounts, 'c1', row('a2', 'before'))).toEqual({
      parentId: 'a',
      position: 1,
    });
  });

  it('puts it just after a row without children, among that row siblings', () => {
    // Without 1, the top level is [2, 3]: right after 2 is index 1.
    expect(resolveChartAccountMove(accounts, 'a', row('b', 'after'))).toEqual({
      parentId: null,
      position: 1,
    });
  });

  it('reads the bottom edge of a row that has children as its first child', () => {
    expect(resolveChartAccountMove(accounts, 'b', row('a', 'after'))).toEqual({
      parentId: 'a',
      position: 0,
    });
  });

  it('lets an account move to another place inside its own level', () => {
    // 1.2 above 1.1, within account 1.
    expect(resolveChartAccountMove(accounts, 'a2', row('a1', 'before'))).toEqual({
      parentId: 'a',
      position: 0,
    });
  });

  it('puts an account at the end of the top level on the root drop zone', () => {
    expect(resolveChartAccountMove(accounts, 'a1', { kind: 'root' })).toEqual({
      parentId: null,
      position: 3,
    });
  });

  it('refuses to drop an account onto itself or anywhere inside its own subtree', () => {
    expect(resolveChartAccountMove(accounts, 'a', row('a', 'inside'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'a', row('a1', 'inside'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'a', row('a1', 'before'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'a', row('a2', 'after'))).toBeNull();
  });

  it('refuses a drop that leaves the account exactly where it is', () => {
    expect(resolveChartAccountMove(accounts, 'a1', row('a2', 'before'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'a1', row('a1', 'before'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'b', row('a', 'after'))).not.toBeNull();
    expect(resolveChartAccountMove(accounts, 'b', row('c', 'before'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'b', row('a', 'before'))).not.toBeNull();
    expect(resolveChartAccountMove(accounts, 'c', { kind: 'root' })).toBeNull();
    expect(resolveChartAccountMove(accounts, 'a2', row('a', 'inside'))).toBeNull();
  });

  it('refuses an account or target that does not exist', () => {
    expect(resolveChartAccountMove(accounts, 'ghost', row('a', 'inside'))).toBeNull();
    expect(resolveChartAccountMove(accounts, 'a1', row('ghost', 'inside'))).toBeNull();
  });

  it('orders siblings numerically, so 1.10 is after 1.2', () => {
    const many = [
      account('p', '1'),
      account('two', '1.2', 'p'),
      account('ten', '1.10', 'p'),
      account('x', '2'),
    ];
    expect(resolveChartAccountMove(many, 'x', row('ten', 'before'))).toEqual({
      parentId: 'p',
      position: 1,
    });
    // 1.10 already sits after 1.2, so dropping it right after 1.2 changes nothing.
    expect(resolveChartAccountMove(many, 'ten', row('two', 'after'))).toBeNull();
    expect(resolveChartAccountMove(many, 'two', row('ten', 'after'))).toEqual({
      parentId: 'p',
      position: 1,
    });
  });
});

describe('describeChartAccountMove', () => {
  const accounts = [
    account('a', '1'),
    account('a1', '1.1', 'a'),
    account('b', '2'),
    account('c', '3'),
  ];

  it('says where under another account, and which position of how many', () => {
    expect(describeChartAccountMove(accounts, 'b', { parentId: 'a', position: 1 })).toBe(
      'Mover «2 · Account 2» bajo «1 · Account 1», a la posición 2 de 2.',
    );
  });

  it('says it is going to the top level', () => {
    expect(describeChartAccountMove(accounts, 'a1', { parentId: null, position: 0 })).toBe(
      'Mover «1.1 · Account 1.1» al nivel raíz, a la posición 1 de 4.',
    );
  });

  it('says it stays in its level when only the position changes', () => {
    expect(describeChartAccountMove(accounts, 'c', { parentId: null, position: 0 })).toBe(
      'Mover «3 · Account 3» dentro del nivel raíz, a la posición 1 de 3.',
    );
  });
});
