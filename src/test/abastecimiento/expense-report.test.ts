import {
  changedResponsibleDetails,
  companyDay,
  EMPTY_RESPONSIBLE_DETAILS,
  expenseDateError,
  expenseReportFileName,
  expenseReportPurchaseOrderFileName,
  expensesMissingReceipt,
  formatReportNumber,
  monthLabel,
  receiptFileError,
  receiptFilesError,
  responsibleDetailsOf,
} from '@/lib/abastecimiento/expense-report';

describe('monthLabel', () => {
  it('names the month a report was opened in', () => {
    expect(monthLabel('2026-08-01')).toBe('agosto 2026');
    expect(monthLabel('2026-02-15')).toBe('febrero 2026');
  });
});

describe('expenseDateError', () => {
  it('accepts a blank date, or any date up to today — a rendición spans weeks, not one month', () => {
    expect(expenseDateError('', '2026-08-20')).toBeUndefined();
    expect(expenseDateError('2026-08-20', '2026-08-20')).toBeUndefined();
    expect(expenseDateError('2026-06-02', '2026-09-23')).toBeUndefined();
  });

  it('rejects a future date', () => {
    expect(expenseDateError('2026-08-25', '2026-08-20')).toMatch(/futura/);
  });
});

describe('receiptFileError', () => {
  it('accepts PDF and photos up to 10MB', () => {
    expect(receiptFileError(undefined)).toBeUndefined();
    expect(receiptFileError({ type: 'image/jpeg', size: 1000 })).toBeUndefined();
    expect(receiptFileError({ type: 'application/pdf', size: 1000 })).toBeUndefined();
  });

  it('rejects other types and oversized files', () => {
    expect(receiptFileError({ type: 'text/plain', size: 10 })).toMatch(/PDF, JPG o PNG/);
    expect(receiptFileError({ type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/10MB/);
  });
});

describe('report number and file name', () => {
  it('pads the number the way the document prints it', () => {
    expect(formatReportNumber(29)).toBe('029');
    expect(formatReportNumber(1234)).toBe('1234');
    expect(expenseReportFileName(29)).toBe('Rendición 029.pdf');
    expect(expenseReportPurchaseOrderFileName(29)).toBe('OC Rendición 029.pdf');
  });
});

describe('responsible details', () => {
  const saved = responsibleDetailsOf({
    taxId: '15.785.173-K',
    jobTitle: 'Gerente General',
    bankName: 'Banco de Chile',
    bankAccountType: null,
    bankAccountNumber: '110-08272-09',
    email: undefined as unknown as null,
  });

  it('starts from what is saved, with blanks for what is missing', () => {
    expect(saved.taxId).toBe('15.785.173-K');
    expect(saved.bankAccountType).toBe('');
    expect(saved.email).toBe('');
    expect(responsibleDetailsOf(undefined)).toEqual(EMPTY_RESPONSIBLE_DETAILS);
  });

  it('reports nothing when the form was not touched', () => {
    expect(changedResponsibleDetails(saved, { ...saved })).toBeUndefined();
    expect(changedResponsibleDetails(saved, { ...saved, jobTitle: '  Gerente General ' })).toBe(
      undefined,
    );
  });

  it('reports only the fields that changed, and a cleared field as blank', () => {
    expect(
      changedResponsibleDetails(saved, {
        ...saved,
        bankAccountType: ' Corriente ',
        bankName: '',
      }),
    ).toEqual({ bankAccountType: 'Corriente', bankName: '' });
  });
});

describe('receiptFilesError', () => {
  it('accepts any number of valid receipts, including none', () => {
    expect(receiptFilesError([])).toBeUndefined();
    expect(
      receiptFilesError([
        { name: 'boleta.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'voucher.pdf', type: 'application/pdf', size: 2000 },
      ]),
    ).toBeUndefined();
  });

  it('names the file that has the problem', () => {
    expect(
      receiptFilesError([
        { name: 'boleta.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'notas.txt', type: 'text/plain', size: 10 },
      ]),
    ).toBe('notas.txt: Solo se aceptan PDF, JPG o PNG.');
    expect(
      receiptFilesError([{ name: 'foto.png', type: 'image/png', size: 11 * 1024 * 1024 }]),
    ).toMatch(/foto\.png: El archivo supera los 10MB/);
  });
});

describe('expensesMissingReceipt', () => {
  it('lists the expenses with no receipt, whether the list is empty or absent', () => {
    const lines = [
      { id: 'a', attachments: [{ id: 'x' }] },
      { id: 'b', attachments: [] },
      { id: 'c' },
      { id: 'd', attachments: [{ id: 'y' }, { id: 'z' }] },
    ];
    expect(expensesMissingReceipt(lines).map((line) => line.id)).toEqual(['b', 'c']);
  });

  it('has nothing missing when every expense has at least one', () => {
    expect(expensesMissingReceipt([{ attachments: [{}] }])).toEqual([]);
    expect(expensesMissingReceipt([])).toEqual([]);
  });
});

describe('companyDay', () => {
  it("reads a timestamp on the company's clock, not UTC's", () => {
    // Late evening of the 14th in Chile is already the 15th in UTC.
    expect(companyDay('2026-09-15T02:30:00Z')).toBe('2026-09-14');
    expect(companyDay('2026-09-15T15:00:00Z')).toBe('2026-09-15');
  });
});
