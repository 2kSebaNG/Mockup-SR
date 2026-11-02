import {
  canCancelPurchaseOrder,
  computeGrossAmount,
  issueDateError,
  ocStepFromStatus,
  paymentDateError,
  purchaseOrderTitle,
  purchaseOrderTotal,
  nextPurchaseOrderSort,
  parsePurchaseOrderSort,
} from '@/lib/abastecimiento/purchase-order';
import { validatePurchaseOrder } from '@/lib/abastecimiento/purchase-order-validation';

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('computeGrossAmount', () => {
  it('adds 19% IVA', () => {
    expect(computeGrossAmount(4_747_780)).toBe(5_649_858);
  });

  it('rounds to the nearest peso', () => {
    expect(computeGrossAmount(1)).toBe(1);
    expect(computeGrossAmount(100)).toBe(119);
  });

  it('is 0 for 0', () => {
    expect(computeGrossAmount(0)).toBe(0);
  });
});

describe('ocStepFromStatus', () => {
  it('maps every real status onto the four-stage stepper', () => {
    expect(ocStepFromStatus('DRAFT')).toBe('draft');
    expect(ocStepFromStatus('SUBMITTED')).toBe('submitted');
    expect(ocStepFromStatus('APPROVED')).toBe('decided');
    expect(ocStepFromStatus('REJECTED')).toBe('decided');
    expect(ocStepFromStatus('PAID')).toBe('paid');
  });

  it('defaults to draft for an unknown or missing status', () => {
    expect(ocStepFromStatus(undefined)).toBe('draft');
    expect(ocStepFromStatus('WHATEVER')).toBe('draft');
  });
});

describe('issueDateError', () => {
  it('accepts a blank value (not yet typed)', () => {
    expect(issueDateError('')).toBeUndefined();
  });

  it('accepts today', () => {
    expect(issueDateError(daysFromToday(0))).toBeUndefined();
  });

  it('accepts a date within the last year', () => {
    expect(issueDateError(daysFromToday(-200))).toBeUndefined();
  });

  it('does not check age until the API limit is known', () => {
    expect(issueDateError(daysFromToday(-4000))).toBeUndefined();
  });

  it('rejects a future date', () => {
    expect(issueDateError(daysFromToday(1))).toBe('No puede ser una fecha futura.');
  });

  it('rejects a date more than a year in the past', () => {
    expect(issueDateError(daysFromToday(-400), 365)).toBe('No puede ser de hace más de un año.');
    expect(issueDateError(daysFromToday(-40), 30)).toBe('No puede ser de hace más de 30 días.');
  });
});

describe('paymentDateError', () => {
  it('accepts a blank payment or issue date (not yet typed)', () => {
    expect(paymentDateError('', '2026-01-10')).toBeUndefined();
    expect(paymentDateError('2026-01-10', '')).toBeUndefined();
  });

  it('accepts a payment date on the same day as the issue date', () => {
    expect(paymentDateError('2026-01-10', '2026-01-10')).toBeUndefined();
  });

  it('accepts a payment date after the issue date', () => {
    expect(paymentDateError('2026-02-01', '2026-01-10')).toBeUndefined();
  });

  it('rejects a payment date before the issue date', () => {
    expect(paymentDateError('2026-01-05', '2026-01-10')).toBe(
      'No puede ser anterior a la fecha de emisión.',
    );
  });
});

const RULES = {
  maxIssueDateAgeDays: 365,
  requiredMetadataFields: [
    'estimatedPaymentDate',
    'paymentRecipientName',
    'paymentRecipientTaxId',
    'bankName',
    'bankAccountType',
    'bankAccountNumber',
    'bankAccountEmail',
  ],
  requiredDocumentTypes: ['QUOTE', 'TRANSFER_RECEIPT'],
} as const;

describe('validatePurchaseOrder', () => {
  const validInput = {
    vendorId: 'vendor-1',
    projectId: 'project-1',
    chartAccountId: 'account-1',
    channel: 'INVOICE',
    date: daysFromToday(-30),
    lines: [
      {
        description: 'Item',
        unit: 'UN',
        quantity: 1,
        unitPrice: 1000,
        procurementPlanItemId: 'pi-1',
      },
    ],
    estimatedPaymentDate: daysFromToday(0),
    paymentRecipientName: 'Destinatario',
    paymentRecipientTaxId: '11.111.111-1',
    bankName: 'Banco',
    bankAccountType: 'Corriente',
    bankAccountNumber: '123456',
    bankAccountEmail: 'destinatario@example.com',
    attachedDocumentTypes: ['QUOTE', 'TRANSFER_RECEIPT'],
  };

  it('returns no errors for a complete purchase order', () => {
    expect(validatePurchaseOrder(validInput, RULES as never)).toEqual({
      missingFields: [],
      invalidFields: [],
      missingDocuments: [],
      pending: false,
    });
  });

  it('reports missing submission fields and documents', () => {
    const result = validatePurchaseOrder(
      { ...validInput, vendorId: '', estimatedPaymentDate: '', attachedDocumentTypes: [] },
      RULES as never,
    );

    expect(result.missingFields).toEqual(['Proveedor', 'Fecha de pago estimada']);
    expect(result.missingDocuments).toEqual(['Cotización', 'Comprobante de transferencia']);
  });

  it('reports incomplete items, invalid email, and date values', () => {
    const result = validatePurchaseOrder(
      {
        ...validInput,
        lines: [{ description: 'Item', unit: 'UN', quantity: 0, unitPrice: 1000 }],
        bankAccountEmail: 'not-an-email',
        estimatedPaymentDate: daysFromToday(-40),
      },
      RULES as never,
    );

    expect(result.invalidFields).toEqual([
      'No puede ser anterior a la fecha de emisión.',
      'Cada ítem necesita descripción, unidad, cantidad y precio unitario válidos.',
      'Correo no válido.',
    ]);
  });

  it('reports a checksum-invalid recipient RUT', () => {
    const result = validatePurchaseOrder(
      { ...validInput, paymentRecipientTaxId: '11.111.111-2' },
      RULES as never,
    );
    expect(result.invalidFields).toEqual(['RUT destinatario no válido.']);
  });

  it('reports an item not linked to a plan item, distinct from an incomplete one', () => {
    const result = validatePurchaseOrder(
      {
        ...validInput,
        lines: [{ description: 'Item', unit: 'UN', quantity: 1, unitPrice: 1000 }],
      },
      RULES as never,
    );
    expect(result.invalidFields).toEqual([
      'Cada ítem debe estar vinculado a uno del plan de abastecimiento.',
    ]);
  });

  it('reports missing items when there are none', () => {
    const result = validatePurchaseOrder({ ...validInput, lines: [] }, RULES as never);
    expect(result.missingFields).toContain('Ítems');
  });

  it('takes what is required from the API rules, not from a fixed list', () => {
    const lenient = {
      ...RULES,
      requiredMetadataFields: ['bankName'],
      requiredDocumentTypes: ['QUOTE'],
    };
    const result = validatePurchaseOrder(
      {
        ...validInput,
        estimatedPaymentDate: '',
        paymentRecipientName: '',
        bankName: '',
        attachedDocumentTypes: [],
      },
      lenient as never,
    );
    expect(result.missingFields).toEqual(['Banco']);
    expect(result.missingDocuments).toEqual(['Cotización']);
  });

  it('is pending, with nothing extra required, until the rules load', () => {
    const result = validatePurchaseOrder({ ...validInput, bankName: '' }, undefined);
    expect(result.pending).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.missingDocuments).toEqual([]);
  });
});

describe('canCancelPurchaseOrder', () => {
  it('allows annulling what has not been paid', () => {
    expect(canCancelPurchaseOrder('DRAFT')).toBe(true);
    expect(canCancelPurchaseOrder('SUBMITTED')).toBe(true);
    expect(canCancelPurchaseOrder('APPROVED')).toBe(true);
  });

  it('does not allow it once paid, rejected or already annulled', () => {
    expect(canCancelPurchaseOrder('PAID')).toBe(false);
    expect(canCancelPurchaseOrder('REJECTED')).toBe(false);
    expect(canCancelPurchaseOrder('CANCELLED')).toBe(false);
    expect(canCancelPurchaseOrder(undefined)).toBe(false);
  });
});

describe('purchaseOrderTotal / purchaseOrderTitle', () => {
  it('adds the IVA to an invoice order but not to an expense-report one', () => {
    expect(purchaseOrderTotal({ amount: 100_000, channel: 'INVOICE' })).toBe(119_000);
    expect(purchaseOrderTotal({ amount: 932_413, channel: 'EXPENSE_REPORT' })).toBe(932_413);
  });

  it('subtracts the withholding tax (from metadata) before computing IVA', () => {
    expect(
      purchaseOrderTotal({
        amount: 100_000,
        channel: 'INVOICE',
        metadata: { withholdingTaxPercent: 10 },
      }),
    ).toBe(107_100);
  });

  it('names an order by its supplier, else its description, else its code', () => {
    expect(purchaseOrderTitle({ vendor: { name: 'MaqRent' }, code: 'P-1' })).toBe('MaqRent');
    expect(
      purchaseOrderTitle({ vendor: null, metadata: { description: 'Rendición 029' }, code: 'P-1' }),
    ).toBe('Rendición 029');
    expect(purchaseOrderTitle({ vendor: null, metadata: null, code: 'P-1' })).toBe('P-1');
    expect(purchaseOrderTitle({})).toBe('—');
  });
});

describe('nextPurchaseOrderSort', () => {
  it('flips the direction of the column that already orders the list', () => {
    expect(nextPurchaseOrderSort({ key: 'createdAt', direction: 'desc' }, 'createdAt')).toEqual({
      key: 'createdAt',
      direction: 'asc',
    });
    expect(nextPurchaseOrderSort({ key: 'amount', direction: 'asc' }, 'amount')).toEqual({
      key: 'amount',
      direction: 'desc',
    });
  });

  it('starts another column descending, largest or most recent first', () => {
    expect(nextPurchaseOrderSort({ key: 'createdAt', direction: 'asc' }, 'amount')).toEqual({
      key: 'amount',
      direction: 'desc',
    });
  });
});

describe('parsePurchaseOrderSort', () => {
  it('reads the column and direction a URL carries', () => {
    expect(parsePurchaseOrderSort('amount', 'asc')).toEqual({ key: 'amount', direction: 'asc' });
  });

  it('defaults to most recently created first', () => {
    expect(parsePurchaseOrderSort(null, null)).toEqual({ key: 'createdAt', direction: 'desc' });
  });

  it('ignores a column or direction it does not know', () => {
    expect(parsePurchaseOrderSort('vendor', 'sideways')).toEqual({
      key: 'createdAt',
      direction: 'desc',
    });
  });
});
