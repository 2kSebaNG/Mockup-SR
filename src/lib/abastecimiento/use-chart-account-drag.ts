import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveChartAccountMove,
  resolveDropZone,
  type ChartAccountDropTarget,
  type ChartAccountMove,
} from './chart-account-tree';

/** Markers the page puts on the elements a drag can land on. */
export const CHART_ACCOUNT_ROW_ATTR = 'data-chart-account-row';
export const CHART_ACCOUNT_ROOT_DROP_ATTR = 'data-chart-root-drop';

export interface ChartAccountDragState {
  /** The account being dragged. */
  id: string;
  /** Where the pointer is, in viewport coordinates (for the floating ghost). */
  x: number;
  y: number;
  /** What the pointer is over, only while dropping there would be a real move. */
  target: ChartAccountDropTarget | null;
  move: ChartAccountMove | null;
}

interface MinimalAccount {
  id: string;
  code: string;
  name: string;
  parentAccountId: string | null;
}

const EDGE_PX = 70;

/**
 * Drag an account around the chart-of-accounts tree with the pointer — one
 * implementation for mouse, finger and pen (the browser's own drag-and-drop does not
 * fire on touch screens). The drag starts from a handle that opts out of touch
 * scrolling (`touch-action: none`), so the rest of a row still scrolls the page; the
 * page scrolls by itself while the pointer is near the top or bottom edge, so a long
 * list can be crossed in one drag; Escape or a cancelled pointer abandons it.
 *
 * What the pointer is over is read from the DOM (`data-chart-account-row` rows and the
 * `data-chart-root-drop` zone) and turned into a move by `resolveChartAccountMove`;
 * dropping on anything that is not a real move does nothing. The window listeners are
 * attached synchronously when the drag starts — not from an effect after the next
 * render — so a very quick tap-and-release cannot leave a drag stuck.
 */
export function useChartAccountDrag({
  accounts,
  enabled,
  onDrop,
}: {
  accounts: MinimalAccount[];
  enabled: boolean;
  onDrop: (accountId: string, move: ChartAccountMove) => void;
}) {
  const [drag, setDrag] = useState<ChartAccountDragState | null>(null);
  const accountsRef = useRef(accounts);
  const onDropRef = useRef(onDrop);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    accountsRef.current = accounts;
    onDropRef.current = onDrop;
  });
  useEffect(() => () => stopRef.current?.(), []);

  const startDrag = useCallback(
    (accountId: string, event: React.PointerEvent) => {
      if (!enabled) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      stopRef.current?.();

      let pointer = { x: event.clientX, y: event.clientY };

      function hit(x: number, y: number) {
        const element = document.elementFromPoint(x, y);
        let target: ChartAccountDropTarget | null = null;
        if (element?.closest(`[${CHART_ACCOUNT_ROOT_DROP_ATTR}]`)) {
          target = { kind: 'root' };
        } else {
          const row = element?.closest<HTMLElement>(`[${CHART_ACCOUNT_ROW_ATTR}]`);
          if (row) {
            const rect = row.getBoundingClientRect();
            target = {
              kind: 'row',
              id: row.getAttribute(CHART_ACCOUNT_ROW_ATTR)!,
              zone: resolveDropZone((y - rect.top) / Math.max(rect.height, 1)),
            };
          }
        }
        const move = target
          ? resolveChartAccountMove(accountsRef.current, accountId, target)
          : null;
        return { target: move ? target : null, move };
      }

      function onMove(moveEvent: PointerEvent) {
        moveEvent.preventDefault();
        pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
        setDrag({ id: accountId, ...pointer, ...hit(pointer.x, pointer.y) });
      }

      function onUp(upEvent: PointerEvent) {
        const { move } = hit(upEvent.clientX, upEvent.clientY);
        stop();
        if (move) onDropRef.current(accountId, move);
      }

      function onKey(keyEvent: KeyboardEvent) {
        if (keyEvent.key === 'Escape') stop();
      }

      let frame = 0;
      function autoScroll() {
        const before = window.scrollY;
        if (pointer.y < EDGE_PX) window.scrollBy(0, -Math.ceil((EDGE_PX - pointer.y) / 4));
        else if (pointer.y > window.innerHeight - EDGE_PX) {
          window.scrollBy(0, Math.ceil((pointer.y - (window.innerHeight - EDGE_PX)) / 4));
        }
        if (window.scrollY !== before) {
          // The page moved under a still pointer, so what it is over changed.
          setDrag({ id: accountId, ...pointer, ...hit(pointer.x, pointer.y) });
        }
        frame = requestAnimationFrame(autoScroll);
      }

      const previousUserSelect = document.body.style.userSelect;
      function stop() {
        cancelAnimationFrame(frame);
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', stop);
        window.removeEventListener('keydown', onKey);
        stopRef.current = null;
        setDrag(null);
      }

      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', stop);
      window.addEventListener('keydown', onKey);
      frame = requestAnimationFrame(autoScroll);
      stopRef.current = stop;

      setDrag({ id: accountId, ...pointer, target: null, move: null });
    },
    [enabled],
  );

  return { drag, startDrag };
}
