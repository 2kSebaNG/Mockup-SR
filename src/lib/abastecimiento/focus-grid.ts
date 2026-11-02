/**
 * The "modo concentración" of a grid: cut a big table down to the few rows and columns
 * that matter, and keep a handful of cells floating to compare them.
 *
 * It works in two steps, so that picking never makes the rest disappear under the
 * cursor: while `choosing`, the whole grid stays on screen and rows and columns are
 * marked; once the person presses "Enfocar" the grid is `focused` and shows only what was
 * marked. Pinned cells float in a tray in either step. Leaving the mode clears the marks
 * and the pins: they live only while the mode is on.
 *
 * Rows and columns are named by string ids, so any grid can use this: it only decides
 * what is marked, what is shown and what is pinned, never how a cell looks.
 */
export type FocusPhase = 'off' | 'choosing' | 'focused';

export interface PinRef {
  rowKey: string;
  colKey: string;
}

export interface FocusState {
  phase: FocusPhase;
  rows: string[];
  cols: string[];
  pins: PinRef[];
}

export type FocusAction =
  | { type: 'enter' }
  | { type: 'exit' }
  | { type: 'toggleRow'; id: string }
  | { type: 'toggleCol'; id: string }
  | { type: 'apply' }
  | { type: 'edit' }
  | { type: 'clearMarks' }
  | { type: 'togglePin'; pin: PinRef }
  | { type: 'prune'; rows: string[]; cols: string[] };

export const INITIAL_FOCUS: FocusState = { phase: 'off', rows: [], cols: [], pins: [] };

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function isPinned(pins: PinRef[], pin: PinRef): boolean {
  return pins.some((p) => p.rowKey === pin.rowKey && p.colKey === pin.colKey);
}

export function focusReducer(state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case 'enter':
      return state.phase === 'off' ? { ...INITIAL_FOCUS, phase: 'choosing' } : state;
    case 'exit':
      return INITIAL_FOCUS;
    case 'toggleRow':
      return state.phase === 'choosing' ? { ...state, rows: toggle(state.rows, action.id) } : state;
    case 'toggleCol':
      return state.phase === 'choosing' ? { ...state, cols: toggle(state.cols, action.id) } : state;
    case 'apply':
      if (state.phase !== 'choosing') return state;
      return state.rows.length > 0 || state.cols.length > 0
        ? { ...state, phase: 'focused' }
        : state;
    case 'edit':
      return state.phase === 'focused' ? { ...state, phase: 'choosing' } : state;
    case 'clearMarks':
      return state.phase === 'off' ? state : { ...state, phase: 'choosing', rows: [], cols: [] };
    case 'togglePin':
      if (state.phase === 'off') return state;
      return {
        ...state,
        pins: isPinned(state.pins, action.pin)
          ? state.pins.filter(
              (p) => !(p.rowKey === action.pin.rowKey && p.colKey === action.pin.colKey),
            )
          : [...state.pins, action.pin],
      };
    case 'prune': {
      const rows = state.rows.filter((id) => action.rows.includes(id));
      const cols = state.cols.filter((id) => action.cols.includes(id));
      const pins = state.pins.filter(
        (p) => action.rows.includes(p.rowKey) && action.cols.includes(p.colKey),
      );
      const unchanged =
        rows.length === state.rows.length &&
        cols.length === state.cols.length &&
        pins.length === state.pins.length;
      if (unchanged) return state;
      // Nothing left to focus on: go back to choosing rather than show an empty grid.
      const phase =
        state.phase === 'focused' && rows.length + cols.length === 0 ? 'choosing' : state.phase;
      return { ...state, phase, rows, cols, pins };
    }
  }
}

const PHASES: FocusPhase[] = ['off', 'choosing', 'focused'];

/**
 * A focus state read back from where it was kept: `null` when it is not one (an old shape, a
 * hand-edited value). Only the marks and the pins come back as they were; a mode with nothing
 * marked comes back off, since there is nothing to remember.
 */
export function parseFocus(raw: unknown): FocusState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<FocusState>;
  const strings = (list: unknown): string[] | null =>
    Array.isArray(list) && list.every((item) => typeof item === 'string') ? list : null;
  const rows = strings(value.rows);
  const cols = strings(value.cols);
  const pins = value.pins;
  if (
    !rows ||
    !cols ||
    !PHASES.includes(value.phase as FocusPhase) ||
    !Array.isArray(pins) ||
    !pins.every((pin) => pin && typeof pin.rowKey === 'string' && typeof pin.colKey === 'string')
  ) {
    return null;
  }
  const phase = value.phase as FocusPhase;
  if (phase === 'off' || (rows.length === 0 && cols.length === 0 && pins.length === 0)) {
    return INITIAL_FOCUS;
  }
  // Focused on nothing is not a thing: it goes back to choosing.
  return {
    phase: phase === 'focused' && rows.length + cols.length === 0 ? 'choosing' : phase,
    rows,
    cols,
    pins,
  };
}

/** The ids to draw: everything, unless the grid is focused and something was marked. An
 * axis with nothing marked is shown whole, so marking only columns keeps every row. */
export function focusedIds(all: string[], marked: string[], phase: FocusPhase): string[] {
  if (phase !== 'focused' || marked.length === 0) return all;
  return all.filter((id) => marked.includes(id));
}

/** What the mode summarizes in its bar. */
export function focusSummary(state: FocusState): string {
  const rows = state.rows.length;
  const cols = state.cols.length;
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (rows === 0 && cols === 0) return 'Nada marcado todavía';
  return [
    rows > 0 ? part(rows, 'fila', 'filas') : null,
    cols > 0 ? part(cols, 'columna', 'columnas') : null,
  ]
    .filter(Boolean)
    .join(' y ');
}
