import type { components } from './api/schema';

type Scenario = components['schemas']['Scenario'];

/** A scenario with the scenarios derived straight from it. */
export interface ScenarioNode {
  scenario: Scenario;
  children: ScenarioNode[];
  /** Set when it was derived from a scenario that is not among those listed, so the tree can
   * still say where it comes from. */
  detachedFrom?: { id: string; name: string };
}

/** The scenarios of one project (or the portfolio-wide ones) as a forest: what hangs
 * straight from the original, each with what was derived from it. */
export interface ScenarioForest {
  projectId: string | null;
  roots: ScenarioNode[];
}

const byAge = (a: ScenarioNode, b: ScenarioNode) =>
  a.scenario.baseAt.localeCompare(b.scenario.baseAt) ||
  a.scenario.name.localeCompare(b.scenario.name);

/**
 * Builds the lineage of scenarios: every scenario under the one it was derived from, and those
 * that were not derived from any under the original. One forest per project, since a scenario
 * can only be derived from one of its own project; portfolio-wide scenarios form their own.
 * Each level is oldest first, so a branch reads in the order it was made.
 */
export function buildScenarioForests(scenarios: Scenario[]): ScenarioForest[] {
  const nodes = new Map(
    scenarios.map((scenario) => [scenario.id, { scenario, children: [] } as ScenarioNode]),
  );
  const roots = new Map<string | null, ScenarioNode[]>();

  for (const node of nodes.values()) {
    const parentId = node.scenario.parentScenarioId ?? null;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
      continue;
    }
    if (parentId && node.scenario.parent) {
      node.detachedFrom = { id: parentId, name: node.scenario.parent.name };
    }
    const key = node.scenario.projectId ?? null;
    roots.set(key, [...(roots.get(key) ?? []), node]);
  }

  const sortDeep = (list: ScenarioNode[]) => {
    list.sort(byAge);
    list.forEach((node) => sortDeep(node.children));
  };
  return [...roots].map(([projectId, list]) => {
    sortDeep(list);
    return { projectId, roots: list };
  });
}

/** How many scenarios hang from a node, however deep. */
export function descendantCount(node: ScenarioNode): number {
  return node.children.reduce((total, child) => total + 1 + descendantCount(child), 0);
}
