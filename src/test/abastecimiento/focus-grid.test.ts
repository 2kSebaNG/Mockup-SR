import {
  INITIAL_FOCUS,
  focusReducer,
  focusSummary,
  focusedIds,
  isPinned,
  parseFocus,
  type FocusAction,
  type FocusState,
} from '@/lib/abastecimiento/focus-grid';

function run(actions: FocusAction[], from: FocusState = INITIAL_FOCUS): FocusState {
  return actions.reduce(focusReducer, from);
}

const cell = { rowKey: 'r1', colKey: '2026-10-01' };

describe('entering and leaving the mode', () => {
  it('starts off, and entering opens the marking step with nothing marked', () => {
    expect(INITIAL_FOCUS.phase).toBe('off');
    expect(run([{ type: 'enter' }])).toEqual({ phase: 'choosing', rows: [], cols: [], pins: [] });
  });

  it('entering twice changes nothing', () => {
    const marked = run([{ type: 'enter' }, { type: 'toggleRow', id: 'a' }]);
    expect(run([{ type: 'enter' }], marked)).toBe(marked);
  });

  it('leaving clears the marks and the pins: they live only while the mode is on', () => {
    const state = run([
      { type: 'enter' },
      { type: 'toggleRow', id: 'a' },
      { type: 'togglePin', pin: cell },
      { type: 'apply' },
      { type: 'exit' },
    ]);
    expect(state).toEqual(INITIAL_FOCUS);
  });
});

describe('marking rows and columns', () => {
  it('marks and unmarks while choosing', () => {
    const state = run([
      { type: 'enter' },
      { type: 'toggleRow', id: 'a' },
      { type: 'toggleRow', id: 'b' },
      { type: 'toggleCol', id: 'oct' },
      { type: 'toggleRow', id: 'a' },
    ]);
    expect(state.rows).toEqual(['b']);
    expect(state.cols).toEqual(['oct']);
  });

  it('does nothing when the mode is off', () => {
    expect(run([{ type: 'toggleRow', id: 'a' }])).toBe(INITIAL_FOCUS);
  });

  it('leaves the marks alone once focused, so a click cannot make things disappear', () => {
    const focused = run([{ type: 'enter' }, { type: 'toggleRow', id: 'a' }, { type: 'apply' }]);
    expect(
      run(
        [
          { type: 'toggleRow', id: 'b' },
          { type: 'toggleCol', id: 'x' },
        ],
        focused,
      ),
    ).toBe(focused);
  });

  it('clears the marks and goes back to choosing', () => {
    const state = run([
      { type: 'enter' },
      { type: 'toggleRow', id: 'a' },
      { type: 'apply' },
      { type: 'clearMarks' },
    ]);
    expect(state).toMatchObject({ phase: 'choosing', rows: [], cols: [] });
  });
});

describe('focusing', () => {
  it('needs something marked before it focuses', () => {
    const state = run([{ type: 'enter' }, { type: 'apply' }]);
    expect(state.phase).toBe('choosing');
  });

  it('focuses once a row or a column is marked, and can go back to change the marks', () => {
    const focused = run([{ type: 'enter' }, { type: 'toggleCol', id: 'oct' }, { type: 'apply' }]);
    expect(focused.phase).toBe('focused');
    const back = run([{ type: 'edit' }], focused);
    expect(back).toMatchObject({ phase: 'choosing', cols: ['oct'] });
  });

  it('keeps the pins when going back to change the marks', () => {
    const state = run([
      { type: 'enter' },
      { type: 'toggleRow', id: 'a' },
      { type: 'togglePin', pin: cell },
      { type: 'apply' },
      { type: 'edit' },
    ]);
    expect(state.pins).toEqual([cell]);
  });
});

describe('what is shown', () => {
  const all = ['a', 'b', 'c', 'd'];

  it('is everything unless the grid is focused', () => {
    expect(focusedIds(all, ['a'], 'off')).toEqual(all);
    expect(focusedIds(all, ['a'], 'choosing')).toEqual(all);
  });

  it('is only the marked ones, in the grid order, once focused', () => {
    expect(focusedIds(all, ['c', 'a'], 'focused')).toEqual(['a', 'c']);
  });

  it('shows an axis whole when nothing on it was marked', () => {
    expect(focusedIds(all, [], 'focused')).toEqual(all);
  });
});

describe('pins', () => {
  it('pins and unpins a cell while the mode is on', () => {
    const pinned = run([{ type: 'enter' }, { type: 'togglePin', pin: cell }]);
    expect(isPinned(pinned.pins, cell)).toBe(true);
    const unpinned = run([{ type: 'togglePin', pin: cell }], pinned);
    expect(unpinned.pins).toEqual([]);
  });

  it('does not pin while the mode is off', () => {
    expect(run([{ type: 'togglePin', pin: cell }])).toBe(INITIAL_FOCUS);
  });

  it('tells two cells apart by row and column', () => {
    const state = run([{ type: 'enter' }, { type: 'togglePin', pin: cell }]);
    expect(isPinned(state.pins, { rowKey: 'r1', colKey: '2026-11-01' })).toBe(false);
    expect(isPinned(state.pins, { rowKey: 'r2', colKey: '2026-10-01' })).toBe(false);
  });
});

describe('when the data changes under it', () => {
  it('drops marks and pins whose row or column no longer exists', () => {
    const state = run([
      { type: 'enter' },
      { type: 'toggleRow', id: 'gone' },
      { type: 'toggleRow', id: 'kept' },
      { type: 'toggleCol', id: 'oct' },
      { type: 'togglePin', pin: { rowKey: 'gone', colKey: 'oct' } },
      { type: 'togglePin', pin: { rowKey: 'kept', colKey: 'oct' } },
      { type: 'prune', rows: ['kept', 'other'], cols: ['oct'] },
    ]);
    expect(state.rows).toEqual(['kept']);
    expect(state.pins).toEqual([{ rowKey: 'kept', colKey: 'oct' }]);
  });

  it('goes back to choosing rather than show an empty grid', () => {
    const state = run([
      { type: 'enter' },
      { type: 'toggleRow', id: 'gone' },
      { type: 'apply' },
      { type: 'prune', rows: ['other'], cols: [] },
    ]);
    expect(state.phase).toBe('choosing');
  });

  it('changes nothing when everything still exists', () => {
    const state = run([{ type: 'enter' }, { type: 'toggleRow', id: 'a' }]);
    expect(focusReducer(state, { type: 'prune', rows: ['a'], cols: [] })).toBe(state);
  });
});

describe('focusSummary', () => {
  it('says what is marked', () => {
    expect(focusSummary({ ...INITIAL_FOCUS, phase: 'choosing' })).toBe('Nada marcado todavía');
    expect(focusSummary({ ...INITIAL_FOCUS, rows: ['a'] })).toBe('1 fila');
    expect(focusSummary({ ...INITIAL_FOCUS, rows: ['a', 'b'], cols: ['x'] })).toBe(
      '2 filas y 1 columna',
    );
    expect(focusSummary({ ...INITIAL_FOCUS, cols: ['x', 'y', 'z'] })).toBe('3 columnas');
  });
});

describe('parseFocus', () => {
  const kept: FocusState = {
    phase: 'focused',
    rows: ['a'],
    cols: ['sum:budget', '2026-05-01'],
    pins: [cell],
  };

  it('gives back what was kept: the marks, the pins and whether it was focused', () => {
    expect(parseFocus(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
    expect(parseFocus({ ...kept, phase: 'choosing' })).toEqual({ ...kept, phase: 'choosing' });
  });

  it('comes back off when it was off or had nothing marked or pinned', () => {
    expect(parseFocus({ ...kept, phase: 'off' })).toBe(INITIAL_FOCUS);
    expect(parseFocus({ phase: 'choosing', rows: [], cols: [], pins: [] })).toBe(INITIAL_FOCUS);
  });

  it('is never focused on nothing: it goes back to choosing', () => {
    expect(parseFocus({ phase: 'focused', rows: [], cols: [], pins: [cell] })).toEqual({
      phase: 'choosing',
      rows: [],
      cols: [],
      pins: [cell],
    });
  });

  it('is nothing for what is not a focus state', () => {
    expect(parseFocus(null)).toBeNull();
    expect(parseFocus('focused')).toBeNull();
    expect(parseFocus({ phase: 'sideways', rows: [], cols: [], pins: [] })).toBeNull();
    expect(parseFocus({ phase: 'focused', rows: [1], cols: [], pins: [] })).toBeNull();
    expect(parseFocus({ phase: 'focused', rows: ['a'], cols: [] })).toBeNull();
    expect(
      parseFocus({ phase: 'focused', rows: ['a'], cols: [], pins: [{ rowKey: 'a' }] }),
    ).toBeNull();
  });
});
