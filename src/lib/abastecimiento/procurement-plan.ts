import type { components } from './api/schema';

type ProcurementPlanItemGroup = components['schemas']['ProcurementPlanItemGroup'];
type ProcurementPlanItem = components['schemas']['ProcurementPlanItem'];
type ChartAccount = { id: string; parentAccountId: string | null };

export interface ProcurementPlanRootGroup {
  rootAccountId: string;
  totalAmount: number;
  items: ProcurementPlanItemGroup[];
}

/** Walks parentAccountId up to the account with no parent — the wireframe's
 * "Abastecimiento"/"Costo empresa personal" group heads are these roots. An account
 * missing from the list (shouldn't happen, but data can be stale) is its own root. */
export function rootAccountId(chartAccountId: string, accounts: ChartAccount[]): string {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let current = byId.get(chartAccountId);
  const seen = new Set<string>();
  while (current?.parentAccountId && byId.has(current.parentAccountId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentAccountId);
  }
  return current?.id ?? chartAccountId;
}

/** wireframes/Procurement.html's grouping: item rows under the root account they roll
 * up to, root-total first, roots and items both ordered by first appearance. */
export function groupByRootAccount(
  groups: ProcurementPlanItemGroup[],
  accounts: ChartAccount[],
): ProcurementPlanRootGroup[] {
  const byRoot = new Map<string, ProcurementPlanRootGroup>();
  for (const group of groups) {
    const root = rootAccountId(group.chartAccountId, accounts);
    const entry = byRoot.get(root) ?? { rootAccountId: root, totalAmount: 0, items: [] };
    entry.totalAmount += group.totalAmount;
    entry.items.push(group);
    byRoot.set(root, entry);
  }
  return [...byRoot.values()];
}

export const STATUS_LABEL: Record<ProcurementPlanItemGroup['status'], string> = {
  planificado: 'Planificado',
  cotizando: 'Cotizando',
  parcial: 'OC emitidas',
  completo: 'OC emitidas',
};

/** "4/6 OC emitidas" for a partially- or fully-issued item, or just the plain label
 * otherwise — matches the wireframe's two status shapes. */
export function statusText(group: ProcurementPlanItemGroup): string {
  if (group.status === 'parcial' || group.status === 'completo') {
    return `${group.ocLinkedCount}/${group.monthCount} ${STATUS_LABEL[group.status]}`;
  }
  return STATUS_LABEL[group.status];
}

/** The rows of the plan that have no purchase order yet: what is left to order. */
export function pendingItems<T extends Pick<ProcurementPlanItem, 'linkedPurchaseOrder'>>(
  items: T[],
): T[] {
  return items.filter((item) => !item.linkedPurchaseOrder);
}

/** The page of a new purchase order, started from rows of the plan: its project and the rows it
 * will be made of, which the form reads back with `parsePlanItemsParam`. */
export function newPurchaseOrderLink(projectId: string, itemIds: string[]): string {
  const query = new URLSearchParams({ projectId });
  if (itemIds.length > 0) query.set('planItems', itemIds.join(','));
  return `/procurement/purchase-orders/new?${query.toString()}`;
}

/** The ids in `?planItems=a,b,c`, without blanks or repeats. */
export function parsePlanItemsParam(raw: string | null): string[] {
  return [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

/** Rows of the plan that cannot make one order: they are under different accounts (an order has
 * one), or it is not a row of the project. */
export type PlanSelectionProblem = 'mixed-accounts' | 'unknown-item' | 'empty';

export interface PurchaseOrderStart {
  chartAccountId: string;
  /** The vendor the first row suggests, if any does. */
  vendorId: string | null;
  lines: {
    description: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    procurementPlanItemId: string;
  }[];
}

/**
 * What a purchase order starts from when it is made of rows of the plan: their account, a
 * vendor to suggest and one line for each, with the plan's own quantity and price, which can be
 * changed in the order. Or what is wrong with the choice.
 */
export function startPurchaseOrder(
  items: ProcurementPlanItem[],
  ids: string[],
): { start: PurchaseOrderStart } | { problem: PlanSelectionProblem } {
  if (ids.length === 0) return { problem: 'empty' };
  const chosen = ids.map((id) => items.find((item) => item.id === id));
  if (chosen.some((item) => !item)) return { problem: 'unknown-item' };
  const rows = chosen as ProcurementPlanItem[];
  if (new Set(rows.map((row) => row.chartAccountId)).size > 1) return { problem: 'mixed-accounts' };
  return {
    start: {
      chartAccountId: rows[0]!.chartAccountId,
      vendorId: rows.find((row) => row.vendorId)?.vendorId ?? null,
      lines: rows.map((row) => ({
        description: row.itemDescription,
        unit: row.unit,
        quantity: String(row.quantity),
        unitPrice: String(row.unitPrice),
        procurementPlanItemId: row.id,
      })),
    },
  };
}

/** The words for what is wrong with the rows chosen. */
export function selectionProblemText(problem: PlanSelectionProblem): string {
  switch (problem) {
    case 'mixed-accounts':
      return 'Una OC es de una sola cuenta contable: elige ítems de la misma cuenta.';
    case 'unknown-item':
      return 'Alguno de los ítems elegidos ya no está en el plan.';
    default:
      return 'Elige al menos un ítem del plan.';
  }
}
