import {
  buildBudgetTree,
  formatBudgetAmount,
  formatSignedPercent,
  versionDelta,
} from '@/lib/abastecimiento/budget-versions';

function account(
  id: string,
  code: string,
  parentAccountId: string | null,
  amounts: Record<string, number>,
  actual: number | null = null,
) {
  return { chartAccountId: id, code, name: `Account ${code}`, parentAccountId, amounts, actual };
}

describe('buildBudgetTree', () => {
  it('rolls children up into their parent for every version and for real', () => {
    const tree = buildBudgetTree([
      account('c2', '5.2', 'p', { P0: 30, P1: 40 }, 5),
      account('p', '5', null, {}),
      account('c1', '5.1', 'p', { P0: 10, P1: 20 }, 7),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.amounts).toEqual({ P0: 40, P1: 60 });
    expect(tree[0]!.actual).toBe(12);
    expect(tree[0]!.children.map((c) => c.account.code)).toEqual(['5.1', '5.2']);
  });

  it('keeps real null when nothing in the subtree has any', () => {
    const [root] = buildBudgetTree([account('a', '1', null, { P0: 1 })]);
    expect(root!.actual).toBeNull();
  });

  it('treats an account whose parent is not in the list as a root', () => {
    const tree = buildBudgetTree([account('a', '2.1', 'missing', { P0: 1 })]);
    expect(tree.map((n) => n.account.code)).toEqual(['2.1']);
  });

  it('orders codes numerically, so 10 follows 2', () => {
    const tree = buildBudgetTree([account('a', '10', null, {}), account('b', '2', null, {})]);
    expect(tree.map((n) => n.account.code)).toEqual(['2', '10']);
  });
});

describe('versionDelta', () => {
  it('is (current - first) / first', () => {
    expect(versionDelta({ P0: 200, P2: 250 }, 'P0', 'P2')).toBe(0.25);
  });

  it('is null without a baseline or a current value', () => {
    expect(versionDelta({ P0: 0, P1: 5 }, 'P0', 'P1')).toBeNull();
    expect(versionDelta({ P0: 5 }, 'P0', 'P1')).toBeNull();
    expect(versionDelta({ P0: 5 }, 'P0', null)).toBeNull();
  });
});

describe('formatting', () => {
  it('shows millions compactly and small amounts in full', () => {
    // Without a phone's narrow screen (here, no window at all) a figure is whole.
    expect(formatBudgetAmount(1_402_000_000)).toBe('$1.402.000.000');
    expect(formatBudgetAmount(212_700_000)).toBe('$212.700.000');
    expect(formatBudgetAmount(null)).toBe('—');
    expect(formatBudgetAmount(50_000)).not.toMatch(/[MK]/);
  });

  it('signs a positive change explicitly', () => {
    expect(formatSignedPercent(0.045)).toBe('+4,5%');
    expect(formatSignedPercent(-0.02)).toBe('-2,0%');
    expect(formatSignedPercent(null)).toBe('—');
  });
});
