import { editKey } from '@/lib/abastecimiento/projection-overlay';
import {
  changesLabel,
  draftCells,
  scenarioCells,
  suggestedScenarioName,
  withDraftCell,
  withDraftChanges,
} from '@/lib/abastecimiento/projection-draft';

const A = editKey('acct-a', '2026-01-01');
const B = editKey('acct-b', '2026-02-01');

describe('withDraftCell', () => {
  it('adds a cell that differs from the original', () => {
    const next = withDraftCell(new Map(), A, 150, 100);
    expect([...next]).toEqual([[A, 150]]);
  });

  it('replaces what was typed in the cell before', () => {
    const next = withDraftCell(new Map([[A, 150]]), A, 170, 100);
    expect([...next]).toEqual([[A, 170]]);
  });

  it('drops a cell that is put back to the original figure', () => {
    const next = withDraftCell(new Map([[A, 150]]), A, 100, 100);
    expect(next.size).toBe(0);
  });

  it('is not a change to type the figure the cell already has', () => {
    expect(withDraftCell(new Map(), A, 100, 100).size).toBe(0);
    expect(withDraftCell(new Map(), A, null, null).size).toBe(0);
  });

  it('keeps a cell that was emptied while the original has a figure', () => {
    const next = withDraftCell(new Map(), A, null, 100);
    expect(next.has(A)).toBe(true);
    expect(next.get(A)).toBeNull();
  });

  it('never changes the draft it was given', () => {
    const draft = new Map([[A, 1]]);
    withDraftCell(draft, B, 2, null);
    expect([...draft]).toEqual([[A, 1]]);
  });
});

describe('draftCells and scenarioCells', () => {
  const draft = new Map<string, number | null>([
    [A, 150],
    [B, null],
  ]);

  it('splits each key back into its account and month', () => {
    expect(draftCells(draft)).toEqual([
      { chartAccountId: 'acct-a', period: '2026-01-01', amount: 150 },
      { chartAccountId: 'acct-b', period: '2026-02-01', amount: null },
    ]);
  });

  it('reads a cell that was emptied as 0 in a scenario, which has no empty', () => {
    expect(scenarioCells(draft)).toEqual([
      { chartAccountId: 'acct-a', period: '2026-01-01', amount: 150 },
      { chartAccountId: 'acct-b', period: '2026-02-01', amount: 0 },
    ]);
  });
});

describe('labels', () => {
  it('counts changes in the singular and the plural', () => {
    expect(changesLabel(1)).toBe('1 cambio');
    expect(changesLabel(3)).toBe('3 cambios');
  });

  it('suggests a scenario name with the day', () => {
    expect(suggestedScenarioName(new Date(2026, 9, 5))).toMatch(/^Escenario 5 oct/);
  });
});

describe('withDraftChanges', () => {
  const held: Record<string, number | null> = { [A]: 100, [B]: null };
  const originalOf = (accountId: string, period: string) =>
    held[editKey(accountId, period)] ?? null;

  it('sets every cell that differs from what the project holds', () => {
    const next = withDraftChanges(
      new Map(),
      [
        { chartAccountId: 'acct-a', period: '2026-01-01', amount: 150 },
        { chartAccountId: 'acct-b', period: '2026-02-01', amount: 40 },
      ],
      originalOf,
    );
    expect([...next]).toEqual([
      [A, 150],
      [B, 40],
    ]);
  });

  it('drops a cell that ends up holding what the project already has', () => {
    const next = withDraftChanges(
      new Map([[A, 150]]),
      [{ chartAccountId: 'acct-a', period: '2026-01-01', amount: 100 }],
      originalOf,
    );
    expect(next.size).toBe(0);
  });

  it('keeps what was in the draft before and replaces a cell given again', () => {
    const next = withDraftChanges(
      new Map([[A, 150]]),
      [
        { chartAccountId: 'acct-a', period: '2026-01-01', amount: 170 },
        { chartAccountId: 'acct-b', period: '2026-02-01', amount: 40 },
      ],
      originalOf,
    );
    expect([...next]).toEqual([
      [A, 170],
      [B, 40],
    ]);
  });
});
