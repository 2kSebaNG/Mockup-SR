/** The page sizes a list offers, the first being the default (matches the API's own). */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** A positive whole number out of a URL value, or `fallback` for anything else. */
export function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/** A page size the API accepts: one of the offered sizes, otherwise the default. */
export function parsePageSize(value: string | null | undefined): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

/** How many pages `total` rows make — never fewer than one, so an empty list is "page 1 of 1". */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** "1–25 de 312" for the rows a page shows, or "0 resultados" for none. */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 resultados';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `${from}–${to} de ${total}`;
}

export type PageButton = number | 'gap';

/**
 * The page numbers to draw as buttons: always the first and last, the current one and
 * its neighbours, with a gap marker where pages are skipped — e.g. 1 … 4 5 6 … 20.
 * Short lists show every page.
 */
export function pageButtons(current: number, last: number): PageButton[] {
  const wanted = new Set<number>([1, last, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const buttons: PageButton[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1]! > 1) {
      // A single skipped page is shown as itself, not as a gap that hides just one number.
      if (n - pages[i - 1]! === 2) buttons.push(n - 1);
      else buttons.push('gap');
    }
    buttons.push(n);
  });
  return buttons;
}

/**
 * A list's query string after applying `patch` to `current`: undefined, empty and default
 * values are dropped, and anything but a page change returns to page 1 (the old page may
 * not exist under the new filter).
 */
export function patchListQuery(
  current: string,
  patch: Record<string, string | undefined>,
  defaults: Record<string, string | undefined> = {},
): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
    else next.set(key, value);
  }
  const onlyPaging = Object.keys(patch).every((key) => key === 'page');
  if (!onlyPaging) next.delete('page');
  if (next.get('size') === String(DEFAULT_PAGE_SIZE)) next.delete('size');
  return next.toString();
}
