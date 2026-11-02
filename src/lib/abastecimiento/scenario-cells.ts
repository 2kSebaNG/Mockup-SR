interface AdjustmentLike {
  projectId: string;
  chartAccountId: string;
  period: string;
  deltaAmount: number;
}

/** How many cells of a project a scenario changes with respect to the original: the
 * distinct account and month pairs whose adjustments do not cancel out. Adjustments of
 * other projects (a portfolio-wide scenario holds several) do not count. */
export function changedCellCount(adjustments: AdjustmentLike[], projectId: string): number {
  const netByCell = new Map<string, number>();
  for (const adjustment of adjustments) {
    if (adjustment.projectId !== projectId) continue;
    const key = `${adjustment.chartAccountId}|${adjustment.period}`;
    netByCell.set(key, (netByCell.get(key) ?? 0) + adjustment.deltaAmount);
  }
  return [...netByCell.values()].filter((net) => Math.abs(net) >= 0.005).length;
}

/** "3 celdas cambiadas respecto del original" / "Sin cambios todavía". */
export function changedCellsLabel(count: number): string {
  if (count === 0) return 'Sin cambios respecto del original todavía';
  return `${count} ${count === 1 ? 'celda cambiada' : 'celdas cambiadas'} respecto del original`;
}
