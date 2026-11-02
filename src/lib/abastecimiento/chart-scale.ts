/** Round tick values from 0 up to just above `max`: 0, 250, 500, 750, 1000 rather than 0, 237, 474…
 * `count` is how many steps are wanted, give or take. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 1000; value += step) ticks.push(value);
  return ticks;
}

/** Where `value` falls between `min` and `max` on an axis of `size`, `0` at the near end. */
export function scale(value: number, min: number, max: number, size: number): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * size;
}

/** Which of `count` evenly spaced marks the pointer at `x` (0..`width`) is nearest to. */
export function nearestIndex(x: number, width: number, count: number): number {
  if (count <= 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round((x / width) * (count - 1))));
}

/** Every how many labels to write one so they do not run into each other. */
export function labelEvery(count: number, room: number, labelWidth: number): number {
  const fits = Math.max(1, Math.floor(room / labelWidth));
  return Math.max(1, Math.ceil(count / fits));
}

/** Each bar ends at this many times its own budget. What goes past that is drawn striped, to the
 * end: an account at 6000% of its budget would otherwise squeeze every other bar to nothing and
 * the budget tick to a pixel. */
export const BAR_REACH = 1.5;

/** How a bar and its budget tick are laid out, as shares (0..1) of the bar's width. */
export function barLayout(item: { budget: number; value: number }): {
  fill: number;
  tick: number | null;
  past: boolean;
} {
  if (item.budget > 0) {
    const ratio = Math.max(0, item.value) / item.budget;
    return {
      fill: Math.min(ratio, BAR_REACH) / BAR_REACH,
      tick: 1 / BAR_REACH,
      past: ratio > BAR_REACH,
    };
  }
  // With no budget there is nothing to measure against: any spending fills the bar.
  return { fill: item.value > 0 ? 1 : 0, tick: null, past: false };
}
