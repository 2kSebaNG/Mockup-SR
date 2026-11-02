import { BAR_REACH, barLayout } from '@/lib/abastecimiento/chart-scale';

describe('barLayout', () => {
  it('measures each bar against its own budget, with the tick in the same place on all of them', () => {
    const small = barLayout({ budget: 100, value: 50 });
    const large = barLayout({ budget: 1_000_000, value: 500_000 });
    expect(small).toEqual(large);
    expect(small.tick).toBeCloseTo(1 / BAR_REACH);
    expect(small.fill).toBeCloseTo(0.5 / BAR_REACH);
    expect(small.past).toBe(false);
  });

  it('fills the bar to the tick at exactly the budget', () => {
    const exact = barLayout({ budget: 200, value: 200 });
    expect(exact.fill).toBeCloseTo(exact.tick!);
  });

  it('ends a bar that is far past its budget at the end, striped, and does not squeeze the rest', () => {
    // 6000% of the budget: the bar is full, not 60 times wider than the budget tick.
    expect(barLayout({ budget: 100, value: 6000 })).toEqual({
      fill: 1,
      tick: 1 / BAR_REACH,
      past: true,
    });
    // Just past the budget, still inside the reach: not striped.
    expect(barLayout({ budget: 100, value: 140 }).past).toBe(false);
    expect(barLayout({ budget: 100, value: 151 }).past).toBe(true);
  });

  it('has nothing to measure against without a budget: spending fills it, none leaves it empty', () => {
    expect(barLayout({ budget: 0, value: 500 })).toEqual({ fill: 1, tick: null, past: false });
    expect(barLayout({ budget: 0, value: 0 })).toEqual({ fill: 0, tick: null, past: false });
  });
});
