import { labelEvery, nearestIndex, niceTicks, scale } from '@/lib/abastecimiento/chart-scale';

describe('niceTicks', () => {
  it('gives round steps from zero to just above the maximum', () => {
    expect(niceTicks(940, 4)).toEqual([0, 500, 1000]);
    expect(niceTicks(1_240_000_000, 4)).toEqual([0, 500_000_000, 1_000_000_000, 1_500_000_000]);
    expect(niceTicks(7, 4)).toEqual([0, 2, 4, 6, 8]);
  });

  it('has something to draw when there is nothing', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });
});

describe('scale', () => {
  it('places a value along an axis', () => {
    expect(scale(50, 0, 100, 200)).toBe(100);
    expect(scale(0, 0, 100, 200)).toBe(0);
    expect(scale(5, 5, 5, 200)).toBe(0);
  });
});

describe('nearestIndex', () => {
  it('finds the mark the pointer is nearest to, clamped to the ends', () => {
    expect(nearestIndex(0, 100, 5)).toBe(0);
    expect(nearestIndex(100, 100, 5)).toBe(4);
    expect(nearestIndex(60, 100, 5)).toBe(2);
    expect(nearestIndex(-20, 100, 5)).toBe(0);
    expect(nearestIndex(500, 100, 5)).toBe(4);
    expect(nearestIndex(50, 100, 1)).toBe(0);
  });
});

describe('labelEvery', () => {
  it('writes every label when there is room, and fewer when there is not', () => {
    expect(labelEvery(6, 600, 60)).toBe(1);
    expect(labelEvery(24, 600, 60)).toBe(3);
    expect(labelEvery(24, 10, 60)).toBe(24);
  });
});
