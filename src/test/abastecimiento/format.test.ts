import {
  formatAmount,
  formatDateTime,
  formatRelativeTime,
  formatSignedDisplayAmount,
} from '@/lib/abastecimiento/format';

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-22T18:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders under a minute as "recién"', () => {
    expect(formatRelativeTime('2026-09-22T17:59:40.000Z')).toBe('recién');
  });

  it('renders minutes for under an hour', () => {
    expect(formatRelativeTime('2026-09-22T17:45:00.000Z')).toBe('hace 15 min');
  });

  it('renders hours for under a day', () => {
    expect(formatRelativeTime('2026-09-22T16:00:00.000Z')).toBe('hace 2 h');
  });

  it('renders "ayer" for exactly one day ago', () => {
    expect(formatRelativeTime('2026-09-21T18:00:00.000Z')).toBe('ayer');
  });

  it('renders days for more than one day ago', () => {
    expect(formatRelativeTime('2026-09-19T18:00:00.000Z')).toBe('hace 3 días');
  });
});

describe('formatDateTime', () => {
  it('renders the local date and time of an ISO timestamp', () => {
    const iso = new Date(2026, 9, 1, 14, 35).toISOString();
    expect(formatDateTime(iso)).toBe('01-10-2026 14:35');
  });
});

describe('formatSignedDisplayAmount', () => {
  it('puts a plus on what is above and keeps the minus on what is below', () => {
    expect(formatSignedDisplayAmount(1200)).toBe(`+${formatAmount(1200)}`);
    expect(formatSignedDisplayAmount(-300)).toBe(formatAmount(-300));
    expect(formatSignedDisplayAmount(-300).startsWith('+')).toBe(false);
  });

  it('gives zero no sign, and a dash when there is nothing', () => {
    expect(formatSignedDisplayAmount(0)).toBe(formatAmount(0));
    expect(formatSignedDisplayAmount(null)).toBe('—');
    expect(formatSignedDisplayAmount(undefined)).toBe('—');
  });
});
