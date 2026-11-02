/**
 * Saves what a person types, one cell at a time and in order, so the last thing typed is
 * always the one that stays.
 *
 * Typing into a grid is fast: a cell can be changed again while its previous change is
 * still travelling. Sent as separate requests at once they could arrive in any order, and
 * the older value could land last. Here each key (a cell) has at most one save running;
 * anything typed meanwhile replaces whatever was waiting, so only the newest value is sent
 * next and the ones in between are skipped.
 *
 * `latest` is what the person last asked for and has not been confirmed yet: it is what
 * the screen should show for that key until the save has settled, and what a new entry
 * should be compared with. It is dropped once nothing newer is waiting, and after a
 * failure, so the key goes back to what the server holds.
 */
export class SaveQueue<T> {
  private readonly pending = new Map<string, T>();
  private readonly running = new Set<string>();
  private readonly waiting = new Map<string, T>();

  constructor(
    private readonly save: (key: string, value: T) => Promise<unknown>,
    private readonly onChange: (latest: ReadonlyMap<string, T>) => void,
  ) {}

  /** What was last asked for and has not settled yet, or `undefined` for none. */
  latest(key: string): T | undefined {
    return this.pending.get(key);
  }

  hasLatest(key: string): boolean {
    return this.pending.has(key);
  }

  push(key: string, value: T): void {
    this.pending.set(key, value);
    this.emit();
    if (this.running.has(key)) {
      this.waiting.set(key, value);
      return;
    }
    void this.run(key, value);
  }

  private async run(key: string, value: T): Promise<void> {
    this.running.add(key);
    try {
      await this.save(key, value);
    } catch {
      // Whoever supplied `save` already told the person; the queue only moves on.
    }
    this.running.delete(key);

    if (this.waiting.has(key)) {
      const next = this.waiting.get(key) as T;
      this.waiting.delete(key);
      await this.run(key, next);
      return;
    }
    this.pending.delete(key);
    this.emit();
  }

  private emit() {
    this.onChange(new Map(this.pending));
  }
}
