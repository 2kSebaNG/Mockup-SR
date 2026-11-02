/** Chilean peso formatting (no decimals — matches how the source spreadsheets show
 * amounts) for report figures. `null` renders as an em dash, matching section 2.3c's
 * "nunca se inventa un número" — a blank period is shown blank, not as 0. */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

/** "$34,2M", "$12,5K" — an amount short enough for a phone's narrow columns. Millions and
 * thousands (from ten thousand up) get one decimal at most; below that it is the full peso
 * amount, so a small figure is never rounded away. */
export function formatShortAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const size = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const short = (divisor: number, suffix: string) =>
    `${sign}$${(size / divisor).toLocaleString('es-CL', { maximumFractionDigits: 1 })}${suffix}`;
  if (size >= 1_000_000) return short(1_000_000, 'M');
  if (size >= 10_000) return short(1_000, 'K');
  return formatAmount(value);
}

const PHONE_QUERY = '(max-width: 639px)';

/** Whether the screen is a phone's, asked when a figure is drawn (not on the server). */
function onPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches === true;
}

/** What a figure looks like on this screen: the whole amount on a wide one ("$1.402.000.000"),
 * the short one on a phone ("$1.402M"), where the full figure does not fit. */
export function formatDisplayAmount(value: number | null | undefined): string {
  return onPhone() ? formatShortAmount(value) : formatAmount(value);
}

/** An amount with its sign, "+$1.200.000" or "-$300.000", for a difference; as wide as the screen
 * allows, like `formatDisplayAmount`. Zero has no sign. */
export function formatSignedDisplayAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${formatDisplayAmount(value)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** "2026-01-15" -> "15-01-2026" (es-CL short date) — for exact dates (Iteration 2's
 * purchase orders/expenses), as opposed to formatPeriod's month-only granularity. */
export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

/** ISO timestamp -> "01-10-2026 14:35" (es-CL date and time, in the viewer's local
 * time) — for when something happened, as opposed to `formatDate`'s calendar dates. */
export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(isoTimestamp))
    .replace(',', '');
}

/** Milliseconds-ago timestamp -> "recién actualizado" / "actualizado hace N min"
 * (wireframes/Main.html's titlebar subtitle). */
export function formatRelativeMinutes(timestampMs: number): string {
  const minutes = Math.floor((Date.now() - timestampMs) / 60_000);
  if (minutes < 1) return 'actualizado recién';
  if (minutes === 1) return 'actualizado hace 1 min';
  return `actualizado hace ${minutes} min`;
}

/** ISO timestamp -> "hace 2 h" / "ayer" / "hace 3 días" (wireframes/OCApprovalQueue.html's
 * "Enviada" column) — coarser granularity than `formatRelativeMinutes`, for things
 * that stay relevant over days rather than a dashboard refreshed every few minutes. */
export function formatRelativeTime(isoTimestamp: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 60_000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

/** "2026-01-01" -> "ene 2026" (es-CL short month). */
export function formatPeriod(period: string): string {
  const date = new Date(`${period}T00:00:00`);
  const formatted = new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(
    date,
  );
  return formatted.replace('.', '');
}
