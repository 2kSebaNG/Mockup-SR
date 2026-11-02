/** What a budget being written in the app is made of, apart from how it looks. */

export interface BuilderLine {
  chartAccountId: string;
  /** First day of the month, `YYYY-MM-01`. */
  period: string;
  budgetedAmount: number;
}

/** Highest P<n> + 1 — mirrors the backend's label rule, display only. */
export function nextVersionLabel(versions: string[]): string {
  let max = -1;
  for (const version of versions) {
    const match = /^P(\d+)$/.exec(version);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `P${max + 1}`;
}

/** Whether the pieces around a separator are thousands groups: a first group of up to three digits
 * that does not start with a zero ("0.456" is under one, not 456), then groups of exactly three. */
function groupedByThousands(groups: string[]): boolean {
  return (
    groups.length > 1 &&
    groups[0]!.length <= 3 &&
    !groups[0]!.startsWith('0') &&
    groups.slice(1).every((group) => group.length === 3)
  );
}

/**
 * An amount as it is typed or pasted from a spreadsheet: "1.234.567", "1,234,567", "$ 1.234,50",
 * "1234.5". `null` for nothing, for what is not a number and for a negative: a budget is not
 * below zero. With both separators the last one is the decimal point; a lone one is a thousands
 * separator when what follows it is groups of three digits, and a decimal point otherwise.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text
    .replace(/[\s\u00a0$]/g, '')
    .replace(/^\+/, '')
    .trim();
  if (cleaned === '' || cleaned.startsWith('-')) return null;
  if (!/^[\d.,]+$/.test(cleaned)) return null;
  let normalized: string;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = cleaned.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    const groups = cleaned.split(',');
    const thousands = groupedByThousands(groups);
    normalized = thousands ? groups.join('') : cleaned.replace(',', '.');
  } else if (lastDot >= 0) {
    const groups = cleaned.split('.');
    const thousands = groupedByThousands(groups);
    normalized = thousands ? groups.join('') : cleaned;
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/** What was copied from a spreadsheet, as rows of cells: tabs between cells, a line for each row
 * (and the empty line a copy ends with is not a row). */
export function parsePasted(text: string): string[][] {
  const rows = text.replace(/\r\n?/g, '\n').split('\n');
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
  return rows.map((row) => row.split('\t'));
}

/** Whether a paste is a block of cells (more than one) rather than one value to type in. */
export function isBlockPaste(text: string): boolean {
  return /[\t\n\r]/.test(text.replace(/[\t\r\n]+$/, ''));
}

/** `count` months from `start` ("2026-05"), as `YYYY-MM-01`. */
export function monthsFrom(start: string, count: number): string[] {
  const match = /^(\d{4})-(\d{2})/.exec(start);
  if (!match || count < 1) return [];
  let year = Number(match[1]);
  let month = Number(match[2]);
  const months: string[] = [];
  for (let index = 0; index < count; index += 1) {
    months.push(`${year}-${String(month).padStart(2, '0')}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** The month after `period` (`YYYY-MM-01`). */
export function monthAfter(period: string): string {
  return monthsFrom(period.slice(0, 7), 2)[1]!;
}

/**
 * `total` shared out in equal parts of whole pesos (the app writes budgets in whole pesos), the few
 * pesos that do not divide going to the first parts, so the parts add up to the total exactly.
 */
export function spreadEvenly(total: number, parts: number): number[] {
  if (parts < 1) return [];
  const pesos = Math.round(total);
  const each = Math.floor(pesos / parts);
  const extra = pesos - each * parts;
  return Array.from({ length: parts }, (_, index) => each + (index < extra ? 1 : 0));
}

export function cellKey(chartAccountId: string, period: string): string {
  return `${chartAccountId}|${period}`;
}

/**
 * What the cells typed say as budget lines to send, and which of them are not an amount.
 * Starting from a version, only what differs from it is sent (the rest is carried over, so a
 * cell cannot be emptied: that is "not an amount"); from nothing, every cell with an amount is,
 * and an empty one is simply not in the budget.
 */
export function builderLines(
  edits: Record<string, string>,
  original: ReadonlyMap<string, number>,
  blank: boolean,
): { lines: BuilderLine[]; invalid: string[] } {
  const lines: BuilderLine[] = [];
  const invalid: string[] = [];
  for (const [key, raw] of Object.entries(edits)) {
    const [chartAccountId, period] = key.split('|');
    if (raw.trim() === '') {
      if (!blank && original.has(key)) invalid.push(key);
      continue;
    }
    const value = parseAmount(raw);
    if (value === null) {
      invalid.push(key);
      continue;
    }
    if (!blank && value === original.get(key)) continue;
    lines.push({ chartAccountId: chartAccountId!, period: period!, budgetedAmount: value });
  }
  return { lines, invalid };
}

/**
 * Puts a pasted block into the cells, from the cell it was pasted in and going right and down; what
 * falls outside the table is left out. Returns the new edits and how many cells were filled.
 */
export function pasteBlock(
  edits: Record<string, string>,
  block: string[][],
  from: { row: number; column: number },
  accountIds: string[],
  periods: string[],
): { edits: Record<string, string>; filled: number } {
  const next = { ...edits };
  let filled = 0;
  block.forEach((cells, rowOffset) => {
    const accountId = accountIds[from.row + rowOffset];
    if (!accountId) return;
    cells.forEach((text, columnOffset) => {
      const period = periods[from.column + columnOffset];
      if (!period) return;
      const value = parseAmount(text);
      // Whole pesos, as the cells hold them; what is not an amount stays as typed, to be flagged.
      next[cellKey(accountId, period)] = value === null ? text.trim() : String(Math.round(value));
      filled += 1;
    });
  });
  return { edits: next, filled };
}
