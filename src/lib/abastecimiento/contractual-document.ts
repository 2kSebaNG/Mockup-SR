import type { components } from './api/schema';

export type ContractualDocument = components['schemas']['ContractualDocument'];
export type ContractualDocumentStatus = ContractualDocument['status'];
export type ExpiryFilter = 'ALL' | ContractualDocumentStatus;

export const STATUS_LABEL: Record<ContractualDocumentStatus, string> = {
  EXPIRED: 'Vencida',
  EXPIRING_SOON: 'Por vencer',
  CURRENT: 'Vigente',
};

const EXPIRY_FILTERS: ExpiryFilter[] = ['ALL', 'EXPIRED', 'EXPIRING_SOON', 'CURRENT'];

/** The filter chip a URL's `status` names; anything unknown (or absent) is "Todos". */
export function parseExpiryFilter(value: string | null | undefined): ExpiryFilter {
  return EXPIRY_FILTERS.find((filter) => filter === value) ?? 'ALL';
}

/** Mirrors ContractualDocumentsService's own check (budget-control-api) — a validity
 * period can't end before it starts. `undefined` when fine or either date is blank. */
export function validityError(validFrom: string, validUntil: string): string | undefined {
  if (!validFrom || !validUntil) return undefined;
  return validUntil < validFrom
    ? 'La vigencia hasta no puede ser anterior a la vigencia desde.'
    : undefined;
}
