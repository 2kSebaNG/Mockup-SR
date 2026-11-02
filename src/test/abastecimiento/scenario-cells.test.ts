import { changedCellCount, changedCellsLabel } from '@/lib/abastecimiento/scenario-cells';

const adj = (projectId: string, chartAccountId: string, period: string, deltaAmount: number) => ({
  projectId,
  chartAccountId,
  period,
  deltaAmount,
});

describe('changedCellCount', () => {
  it('counts each account and month the scenario changes once', () => {
    expect(
      changedCellCount(
        [
          adj('p', 'a', '2026-10-01', 5),
          adj('p', 'a', '2026-11-01', 5),
          adj('p', 'b', '2026-10-01', -3),
        ],
        'p',
      ),
    ).toBe(3);
  });

  it('counts a cell once however many adjustments sit on it', () => {
    expect(
      changedCellCount([adj('p', 'a', '2026-10-01', 5), adj('p', 'a', '2026-10-01', 2)], 'p'),
    ).toBe(1);
  });

  it('does not count a cell whose adjustments cancel out', () => {
    expect(
      changedCellCount([adj('p', 'a', '2026-10-01', 5), adj('p', 'a', '2026-10-01', -5)], 'p'),
    ).toBe(0);
  });

  it('only counts the project being looked at', () => {
    expect(
      changedCellCount([adj('p', 'a', '2026-10-01', 5), adj('other', 'a', '2026-10-01', 9)], 'p'),
    ).toBe(1);
  });

  it('is zero for a scenario with nothing in it', () => {
    expect(changedCellCount([], 'p')).toBe(0);
  });
});

describe('changedCellsLabel', () => {
  it('says what changed, in the singular and the plural', () => {
    expect(changedCellsLabel(0)).toBe('Sin cambios respecto del original todavía');
    expect(changedCellsLabel(1)).toBe('1 celda cambiada respecto del original');
    expect(changedCellsLabel(4)).toBe('4 celdas cambiadas respecto del original');
  });
});
