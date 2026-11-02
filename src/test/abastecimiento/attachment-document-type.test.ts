import { buildDocumentChecklist } from '@/lib/abastecimiento/attachment-document-type';

describe('buildDocumentChecklist', () => {
  it('buckets attachments by documentType, in the fixed display order', () => {
    const rows = buildDocumentChecklist([
      { id: '1', documentType: 'INVOICE' as const },
      { id: '2', documentType: 'QUOTE' as const },
    ]);
    expect(rows.map((r) => r.documentType)).toEqual([
      'QUOTE',
      'PURCHASE_ORDER_PDF',
      'TRANSFER_RECEIPT',
      'DISPATCH_GUIDE',
      'MANUAL',
      'INVOICE',
      'EMAIL_BACKUP',
    ]);
    expect(rows.find((r) => r.documentType === 'QUOTE')!.files).toHaveLength(1);
    expect(rows.find((r) => r.documentType === 'INVOICE')!.files).toHaveLength(1);
    expect(rows.find((r) => r.documentType === 'MANUAL')!.files).toHaveLength(0);
  });

  it('flags dispatch guide, manual, and the auto-generated OC PDF as optional', () => {
    const rows = buildDocumentChecklist([]);
    const optional = rows.filter((r) => r.optional).map((r) => r.documentType);
    expect(optional.sort()).toEqual(['DISPATCH_GUIDE', 'MANUAL', 'PURCHASE_ORDER_PDF'].sort());
  });

  it('buckets a missing documentType as OTHER, which the checklist rows do not include', () => {
    const rows = buildDocumentChecklist([{ id: '1', documentType: null }]);
    const total = rows.reduce((sum, r) => sum + r.files.length, 0);
    expect(total).toBe(0);
    expect(rows.map((r) => r.documentType)).not.toContain('OTHER');
  });

  it('groups multiple files of the same type together (e.g. several backup emails)', () => {
    const rows = buildDocumentChecklist([
      { id: '1', documentType: 'EMAIL_BACKUP' as const },
      { id: '2', documentType: 'EMAIL_BACKUP' as const },
    ]);
    expect(rows.find((r) => r.documentType === 'EMAIL_BACKUP')!.files).toHaveLength(2);
  });
});
