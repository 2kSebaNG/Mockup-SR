import type { components } from '@/lib/abastecimiento/api/schema';
import { buildScenarioForests, descendantCount } from '@/lib/abastecimiento/scenario-tree';

type Scenario = components['schemas']['Scenario'];

let counter = 0;
function scenario(
  id: string,
  options: {
    projectId?: string | null;
    parent?: string;
    parentName?: string;
    baseAt?: string;
    isBase?: boolean;
  } = {},
): Scenario {
  counter += 1;
  return {
    id,
    projectId: options.projectId === undefined ? 'p1' : options.projectId,
    name: `Escenario ${id}`,
    baseAt: options.baseAt ?? `2026-01-${String(counter).padStart(2, '0')}T00:00:00Z`,
    status: 'DRAFT',
    createdBy: 'u',
    parentScenarioId: options.parent ?? null,
    parentVersionId: null,
    isBase: options.isBase ?? false,
    parent: options.parent
      ? { id: options.parent, name: options.parentName ?? `Escenario ${options.parent}` }
      : null,
  } as Scenario;
}

const ids = (nodes: { scenario: Scenario }[]) => nodes.map((n) => n.scenario.id);

describe('buildScenarioForests', () => {
  it('puts each scenario under the one it was derived from', () => {
    const [forest] = buildScenarioForests([
      scenario('a'),
      scenario('b', { parent: 'a' }),
      scenario('c', { parent: 'a' }),
      scenario('d', { parent: 'b' }),
    ]);
    expect(ids(forest!.roots)).toEqual(['a']);
    expect(ids(forest!.roots[0]!.children)).toEqual(['b', 'c']);
    expect(ids(forest!.roots[0]!.children[0]!.children)).toEqual(['d']);
  });

  it('keeps what was not derived from any scenario at the top, oldest first', () => {
    const [forest] = buildScenarioForests([
      scenario('late', { baseAt: '2026-03-01T00:00:00Z' }),
      scenario('early', { baseAt: '2026-01-01T00:00:00Z' }),
      scenario('mid', { baseAt: '2026-02-01T00:00:00Z' }),
    ]);
    expect(ids(forest!.roots)).toEqual(['early', 'mid', 'late']);
  });

  it('is one forest per project, and the portfolio-wide ones apart', () => {
    const forests = buildScenarioForests([
      scenario('a', { projectId: 'p1' }),
      scenario('b', { projectId: 'p2' }),
      scenario('c', { projectId: null }),
      scenario('d', { projectId: 'p1', parent: 'a' }),
    ]);
    expect(forests.map((f) => f.projectId).sort()).toEqual([null, 'p1', 'p2']);
    const p1 = forests.find((f) => f.projectId === 'p1')!;
    expect(ids(p1.roots[0]!.children)).toEqual(['d']);
  });

  it('keeps a scenario whose parent is not in the list at the top, saying where it comes from', () => {
    const [forest] = buildScenarioForests([
      scenario('b', { parent: 'gone', parentName: 'Escenario gone' }),
    ]);
    expect(ids(forest!.roots)).toEqual(['b']);
    expect(forest!.roots[0]!.detachedFrom).toEqual({ id: 'gone', name: 'Escenario gone' });
  });

  it('does not say a scenario is detached when its parent is there', () => {
    const [forest] = buildScenarioForests([scenario('a'), scenario('b', { parent: 'a' })]);
    expect(forest!.roots[0]!.children[0]!.detachedFrom).toBeUndefined();
  });

  it('is nothing for no scenarios', () => {
    expect(buildScenarioForests([])).toEqual([]);
  });
});

describe('descendantCount', () => {
  it('counts every scenario below a node, however deep', () => {
    const [forest] = buildScenarioForests([
      scenario('a'),
      scenario('b', { parent: 'a' }),
      scenario('c', { parent: 'b' }),
      scenario('d', { parent: 'a' }),
    ]);
    expect(descendantCount(forest!.roots[0]!)).toBe(3);
    expect(descendantCount(forest!.roots[0]!.children[0]!)).toBe(1);
  });
});
