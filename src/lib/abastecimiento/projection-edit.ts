import { rowCell, type GridRowModel, type GridView } from './projection-grid';
import { isGroupKey } from './projection-periods';

/** Whether a month cell can take a projection typed into it: only while the months show
 * the projection (the IC view or "Proyectado"), only on an account that is not a group (a
 * group is the sum of its children), and only where there is no real yet (the real comes
 * from the purchase orders and is never typed over). A "directo en el grupo" row can only
 * be adjusted where a projection already sits on the group, so it can be corrected or
 * cleared but never grows new ones. */
export function isCellEditable(row: GridRowModel, period: string, view: GridView): boolean {
  if (view !== 'reported' && view !== 'forecast') return false;
  // A quarter, a semester or a year is a sum: a projection is typed in a month.
  if (isGroupKey(period)) return false;
  if (row.expandable) return false;
  const cell = rowCell(row, period);
  if (cell.actual !== null) return false;
  return row.own ? cell.forecast !== null : true;
}

/** One cell of the grid, as a stable key. */
export function cellKey(row: GridRowModel, period: string): string {
  return `${row.key}|${period}`;
}

export type CellMove = 'down' | 'up' | 'right' | 'left';

export interface CellRef {
  rowKey: string;
  period: string;
}

/** The editable cell to jump to after typing in one: down or up the same month, or right
 * or left along the same account, skipping what cannot be edited, and what `isBlocked` says is
 * not typed in directly (a cell made of concepts). `null` at the edge. */
export function nextEditableCell(
  rows: GridRowModel[],
  periods: string[],
  view: GridView,
  from: CellRef,
  move: CellMove,
  isBlocked?: (row: GridRowModel, period: string) => boolean,
): CellRef | null {
  const editable = (row: GridRowModel, period: string) =>
    isCellEditable(row, period, view) && !isBlocked?.(row, period);
  const rowIndex = rows.findIndex((row) => row.key === from.rowKey);
  const periodIndex = periods.indexOf(from.period);
  if (rowIndex < 0 || periodIndex < 0) return null;

  if (move === 'down' || move === 'up') {
    const step = move === 'down' ? 1 : -1;
    for (let i = rowIndex + step; i >= 0 && i < rows.length; i += step) {
      if (editable(rows[i]!, from.period)) {
        return { rowKey: rows[i]!.key, period: from.period };
      }
    }
    return null;
  }

  const step = move === 'right' ? 1 : -1;
  for (let i = periodIndex + step; i >= 0 && i < periods.length; i += step) {
    if (editable(rows[rowIndex]!, periods[i]!)) {
      return { rowKey: from.rowKey, period: periods[i]! };
    }
  }
  return null;
}
