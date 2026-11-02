import { SaveQueue } from '@/lib/abastecimiento/save-queue';

/** A save the test settles by hand, so it can say exactly when a request finishes. */
function manualSave() {
  const calls: { key: string; value: number | null; settle: (ok?: boolean) => void }[] = [];
  const save = vi.fn(
    (key: string, value: number | null) =>
      new Promise<void>((resolve, reject) => {
        calls.push({
          key,
          value,
          settle: (ok = true) => (ok ? resolve() : reject(new Error('x'))),
        });
      }),
  );
  return { save, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function build() {
  const { save, calls } = manualSave();
  const changes: Map<string, number | null>[] = [];
  const queue = new SaveQueue<number | null>(save, (latest) => changes.push(new Map(latest)));
  return { queue, save, calls, changes };
}

describe('SaveQueue', () => {
  it('saves a value straight away and shows it until the save settles', async () => {
    const { queue, calls } = build();
    queue.push('a', 200);
    expect(calls).toHaveLength(1);
    expect(queue.latest('a')).toBe(200);
    calls[0]!.settle();
    await flush();
    expect(queue.hasLatest('a')).toBe(false);
  });

  it('keeps the last value typed while the first is still saving: it goes out after, never before', async () => {
    const { queue, calls } = build();
    queue.push('a', 200);
    queue.push('a', 300);
    // Only one request is out; the newer one waits for it instead of racing it.
    expect(calls.map((c) => c.value)).toEqual([200]);
    expect(queue.latest('a')).toBe(300);

    calls[0]!.settle();
    await flush();
    expect(calls.map((c) => c.value)).toEqual([200, 300]);
    expect(queue.latest('a')).toBe(300);

    calls[1]!.settle();
    await flush();
    expect(queue.hasLatest('a')).toBe(false);
  });

  it('skips the values in between and sends only the newest after the one in flight', async () => {
    const { queue, calls } = build();
    queue.push('a', 1);
    queue.push('a', 2);
    queue.push('a', 3);
    queue.push('a', 4);
    calls[0]!.settle();
    await flush();
    expect(calls.map((c) => c.value)).toEqual([1, 4]);
  });

  it('can clear a cell: null is a value, not "nothing waiting"', async () => {
    const { queue, calls } = build();
    queue.push('a', 100);
    queue.push('a', null);
    calls[0]!.settle();
    await flush();
    expect(calls.map((c) => c.value)).toEqual([100, null]);
    expect(queue.latest('a')).toBeNull();
    expect(queue.hasLatest('a')).toBe(true);
  });

  it('does not make different cells wait for each other', async () => {
    const { queue, calls } = build();
    queue.push('a', 1);
    queue.push('b', 2);
    expect(calls.map((c) => [c.key, c.value])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('goes back to what the server holds after a failure with nothing newer', async () => {
    const { queue, calls } = build();
    queue.push('a', 200);
    calls[0]!.settle(false);
    await flush();
    expect(queue.hasLatest('a')).toBe(false);
  });

  it('still sends the newer value after the older one failed', async () => {
    const { queue, calls } = build();
    queue.push('a', 200);
    queue.push('a', 300);
    calls[0]!.settle(false);
    await flush();
    expect(calls.map((c) => c.value)).toEqual([200, 300]);
    expect(queue.latest('a')).toBe(300);
    calls[1]!.settle();
    await flush();
    expect(queue.hasLatest('a')).toBe(false);
  });

  it('tells its owner every time what is pending', async () => {
    const { queue, calls, changes } = build();
    queue.push('a', 5);
    calls[0]!.settle();
    await flush();
    expect(changes.map((c) => c.get('a'))).toEqual([5, undefined]);
  });
});
