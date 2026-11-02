import { DOCUMENT_TYPE_LABEL, type AttachmentDocumentType } from './attachment-document-type';
import type { components } from './api/schema';
import { issueDateError, paymentDateError } from './purchase-order';
import { isValidRut } from './rut';

export type PurchaseOrderRules = components['schemas']['PurchaseOrderRules'];

/** Spanish label for each payment-destination field the API can require. What is
 * required comes from the API (`GET /purchase-orders/rules`) — this only names it. */
const METADATA_FIELD_LABEL: Record<string, string> = {
  estimatedPaymentDate: 'Fecha de pago estimada',
  paymentRecipientName: 'Nombre destinatario',
  paymentRecipientTaxId: 'RUT destinatario',
  bankName: 'Banco',
  bankAccountType: 'Tipo de cuenta',
  bankAccountNumber: 'N° cuenta',
  bankAccountEmail: 'Correo',
};

export interface PurchaseOrderLineValidationInput {
  description?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  procurementPlanItemId?: string | null;
}

export interface PurchaseOrderValidationInput {
  vendorId?: string | null;
  projectId?: string | null;
  chartAccountId?: string | null;
  channel?: string | null;
  date?: string | null;
  lines?: PurchaseOrderLineValidationInput[] | null;
  estimatedPaymentDate?: string | null;
  paymentRecipientName?: string | null;
  paymentRecipientTaxId?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountEmail?: string | null;
  attachedDocumentTypes?: readonly string[];
}

export interface PurchaseOrderValidationResult {
  missingFields: string[];
  invalidFields: string[];
  missingDocuments: string[];
  /** True until the API's rules have loaded — nothing can be declared submittable yet. */
  pending: boolean;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * What stops an OC from being submitted, as the form and the detail page show it. The
 * requirements (payment-destination fields, documents, how old an issue date may be)
 * come from the API's own rules, so this can't drift from what it enforces; only the
 * always-required create-time fields below are fixed here, since the create DTO
 * itself demands them.
 */
export function validatePurchaseOrder(
  input: PurchaseOrderValidationInput,
  rules: PurchaseOrderRules | undefined,
): PurchaseOrderValidationResult {
  const baseMissing = [
    !hasText(input.vendorId) && 'Proveedor',
    !hasText(input.projectId) && 'Proyecto',
    !hasText(input.chartAccountId) && 'Cuenta contable',
    !hasText(input.channel) && 'Canal',
    !hasText(input.date) && 'Fecha de emisión',
    (!input.lines || input.lines.length === 0) && 'Ítems',
  ];
  const requiredMissing = (rules?.requiredMetadataFields ?? []).map(
    (field) =>
      !hasText(input[field as keyof PurchaseOrderValidationInput] as string | null | undefined) &&
      (METADATA_FIELD_LABEL[field] ?? field),
  );
  const missingFields = [...baseMissing, ...requiredMissing].filter((label): label is string =>
    Boolean(label),
  );

  const hasIncompleteLine = (input.lines ?? []).some(
    (line) =>
      !hasText(line.description) ||
      !hasText(line.unit) ||
      !Number.isFinite(line.quantity) ||
      (line.quantity ?? 0) <= 0 ||
      !Number.isFinite(line.unitPrice) ||
      (line.unitPrice ?? -1) < 0,
  );
  const hasUnlinkedLine = (input.lines ?? []).some((line) => !hasText(line.procurementPlanItemId));

  const invalidFields = [
    input.date && issueDateError(input.date, rules?.maxIssueDateAgeDays),
    input.estimatedPaymentDate &&
      input.date &&
      paymentDateError(input.estimatedPaymentDate, input.date),
    hasIncompleteLine &&
      'Cada ítem necesita descripción, unidad, cantidad y precio unitario válidos.',
    !hasIncompleteLine &&
      hasUnlinkedLine &&
      'Cada ítem debe estar vinculado a uno del plan de abastecimiento.',
    hasText(input.channel) &&
      !['INVOICE', 'EXPENSE_REPORT'].includes(input.channel!) &&
      'Canal no válido.',
    hasText(input.bankAccountEmail) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.bankAccountEmail!.trim()) &&
      'Correo no válido.',
    hasText(input.paymentRecipientTaxId) &&
      !isValidRut(input.paymentRecipientTaxId!) &&
      'RUT destinatario no válido.',
  ].filter((error): error is string => Boolean(error));

  const attached = new Set(input.attachedDocumentTypes ?? []);
  const missingDocuments = (rules?.requiredDocumentTypes ?? [])
    .filter((type) => !attached.has(type))
    .map((type) => DOCUMENT_TYPE_LABEL[type as AttachmentDocumentType] ?? type);

  return { missingFields, invalidFields, missingDocuments, pending: !rules };
}
