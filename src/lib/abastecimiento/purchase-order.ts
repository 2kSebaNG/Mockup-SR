/** The IVA an order made before the rates were kept in a table was calculated with: 19%. Orders
 * made now carry the IVA of their own date in their metadata (`ivaPercent`). */
export const LEGACY_IVA_PERCENT = 19;

/** Net amount -> total with IVA, rounded to the peso (no cents in this app's amounts,
 * matching formatAmount's maximumFractionDigits: 0). */
export function computeGrossAmount(
  netAmount: number,
  ivaPercent: number = LEGACY_IVA_PERCENT,
): number {
  return Math.round(netAmount * (1 + ivaPercent / 100));
}

/** What an order's amount means depends on its channel — mirrors the API's own
 * `orderTotals` (section 2.3e). `withholdingTaxPercent` (the original OC format's
 * "Impuesto Retenido") only applies to an invoice order, subtracted before IVA. */
export function orderTotals(
  amount: number,
  channel: string | null | undefined,
  withholdingTaxPercent?: number | null,
  ivaPercent: number = LEGACY_IVA_PERCENT,
): {
  subtotal: number;
  withholding: number;
  netAfterWithholding: number;
  tax: number;
  total: number;
  taxIncluded: boolean;
} {
  if (channel === 'EXPENSE_REPORT' || channel === 'PAYROLL') {
    return {
      subtotal: amount,
      withholding: 0,
      netAfterWithholding: amount,
      tax: 0,
      total: amount,
      taxIncluded: true,
    };
  }
  const withholding = withholdingTaxPercent
    ? Math.round(amount * (withholdingTaxPercent / 100))
    : 0;
  const netAfterWithholding = amount - withholding;
  const total = computeGrossAmount(netAfterWithholding, ivaPercent);
  return {
    subtotal: amount,
    withholding,
    netAfterWithholding,
    tax: total - netAfterWithholding,
    total,
    taxIncluded: false,
  };
}

/** What an order is worth in total, reading `withholdingTaxPercent` and `ivaPercent` (the taxes of
 * its own date) off its metadata when present; an order from before them has 19% IVA. */
export function purchaseOrderTotal(order: {
  amount: number;
  channel?: string | null;
  metadata?: unknown;
}): number {
  const metadata = order.metadata as
    { withholdingTaxPercent?: unknown; ivaPercent?: unknown } | null | undefined;
  return orderTotals(
    order.amount,
    order.channel,
    typeof metadata?.withholdingTaxPercent === 'number' ? metadata.withholdingTaxPercent : null,
    typeof metadata?.ivaPercent === 'number' ? metadata.ivaPercent : LEGACY_IVA_PERCENT,
  ).total;
}

/** How a purchase order is named in a list: its supplier, or — for an expense-report
 * order, which has none — its description ("Rendición 029"); its code as a last resort. */
export function purchaseOrderTitle(order: {
  vendor?: { name?: string | null } | null;
  metadata?: unknown;
  code?: string | null;
}): string {
  const description = (order.metadata as { description?: unknown } | null | undefined)?.description;
  return (
    order.vendor?.name ||
    (typeof description === 'string' && description ? description : '') ||
    order.code ||
    '—'
  );
}

export type OcStepKey = 'draft' | 'submitted' | 'decided' | 'paid';

/** Maps a purchase order's real status onto OcStepper's four stages — REJECTED lands
 * on "decided" same as APPROVED, since it's the same step, a different outcome. */
export function ocStepFromStatus(status: string | undefined): OcStepKey {
  switch (status) {
    case 'SUBMITTED':
      return 'submitted';
    case 'APPROVED':
    case 'REJECTED':
      return 'decided';
    case 'PAID':
      return 'paid';
    default:
      return 'draft';
  }
}

/** `undefined` when the given ISO date ("YYYY-MM-DD") is a plausible issue date — not
 * in the future and, once the API's `maxIssueDateAgeDays` is known, not older than that
 * (the limit lives in the API's rules, not here). */
export function issueDateError(value: string, maxAgeDays?: number): string | undefined {
  if (!value) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const issueDate = new Date(`${value}T00:00:00`);
  if (issueDate.getTime() > today.getTime()) return 'No puede ser una fecha futura.';
  if (maxAgeDays !== undefined) {
    const oldestAllowed = new Date(today);
    oldestAllowed.setDate(oldestAllowed.getDate() - maxAgeDays);
    if (issueDate.getTime() < oldestAllowed.getTime()) {
      return maxAgeDays === 365
        ? 'No puede ser de hace más de un año.'
        : `No puede ser de hace más de ${maxAgeDays} días.`;
    }
  }
  return undefined;
}

/** `undefined` when the estimated payment date isn't earlier than the issue date
 * it's paying for (or either is still blank). */
export function paymentDateError(paymentValue: string, issueValue: string): string | undefined {
  if (!paymentValue || !issueValue) return undefined;
  const payment = new Date(`${paymentValue}T00:00:00`);
  const issue = new Date(`${issueValue}T00:00:00`);
  if (payment.getTime() < issue.getTime()) {
    return 'No puede ser anterior a la fecha de emisión.';
  }
  return undefined;
}

export const STATUS_LABEL_ES: Record<string, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
};

/** Statuses an administrator can still annul — a paid order is money that already
 * left, and a rejected or already-annulled one has nothing left to undo. Mirrors the
 * API's transitions; the API is what actually enforces it. */
const CANCELLABLE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'];

export function canCancelPurchaseOrder(status: string | undefined): boolean {
  return status !== undefined && CANCELLABLE_STATUSES.includes(status);
}

export type PurchaseOrderSortKey = 'createdAt' | 'amount';
export type PurchaseOrderSortDirection = 'asc' | 'desc';
export interface PurchaseOrderSort {
  key: PurchaseOrderSortKey;
  direction: PurchaseOrderSortDirection;
}

/** What the list is ordered by when nothing was chosen — the API's own default: most
 * recently created first (by creation date, not the issue date printed on the order). */
export const DEFAULT_PURCHASE_ORDER_SORT: PurchaseOrderSort = {
  key: 'createdAt',
  direction: 'desc',
};

/** What clicking a column header does: the column already ordering the list flips its
 * direction; any other column starts descending (largest / most recent first). */
export function nextPurchaseOrderSort(
  current: PurchaseOrderSort,
  key: PurchaseOrderSortKey,
): PurchaseOrderSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'desc' };
}

/** The sort a URL's `sort`/`dir` values describe, falling back to the default for
 * anything that isn't a known column or direction. */
export function parsePurchaseOrderSort(
  sort: string | null | undefined,
  direction: string | null | undefined,
): PurchaseOrderSort {
  const key = sort === 'amount' || sort === 'createdAt' ? sort : DEFAULT_PURCHASE_ORDER_SORT.key;
  const dir =
    direction === 'asc' || direction === 'desc' ? direction : DEFAULT_PURCHASE_ORDER_SORT.direction;
  return { key, direction: dir };
}
