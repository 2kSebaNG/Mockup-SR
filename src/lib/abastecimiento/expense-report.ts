/** "029" — the report's number as printed on its document. */
export function formatReportNumber(number: number): string {
  return String(number).padStart(3, '0');
}

/** What the browser saves the report's document as. */
export function expenseReportFileName(number: number): string {
  return `Rendición ${formatReportNumber(number)}.pdf`;
}

/** What the browser saves the report's purchase order document as. */
export function expenseReportPurchaseOrderFileName(number: number): string {
  return `OC Rendición ${formatReportNumber(number)}.pdf`;
}

/** What the expense-report document prints about its responsible person, kept on the
 * person so it is typed once and reused by every later report. */
export interface ResponsibleDetails {
  taxId: string;
  jobTitle: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  email: string;
}

export const EMPTY_RESPONSIBLE_DETAILS: ResponsibleDetails = {
  taxId: '',
  jobTitle: '',
  bankName: '',
  bankAccountType: '',
  bankAccountNumber: '',
  email: '',
};

export function responsibleDetailsOf(
  person: Partial<Record<keyof ResponsibleDetails, string | null>> | undefined,
): ResponsibleDetails {
  return {
    taxId: person?.taxId ?? '',
    jobTitle: person?.jobTitle ?? '',
    bankName: person?.bankName ?? '',
    bankAccountType: person?.bankAccountType ?? '',
    bankAccountNumber: person?.bankAccountNumber ?? '',
    email: person?.email ?? '',
  };
}

/** Only the fields the user actually changed (blank counts as a change when the
 * person had a value), or `undefined` when nothing did — so a report can be created
 * without a needless update of the person. */
export function changedResponsibleDetails(
  original: ResponsibleDetails,
  edited: ResponsibleDetails,
): Partial<ResponsibleDetails> | undefined {
  const changes: Partial<ResponsibleDetails> = {};
  for (const key of Object.keys(original) as (keyof ResponsibleDetails)[]) {
    if (edited[key].trim() !== original[key].trim()) changes[key] = edited[key].trim();
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** "septiembre 2026" — the month a report was opened in. Doesn't bound its expenses:
 * a rendición can stay open for however many weeks it takes, across months. */
export function monthLabel(period: string): string {
  const [year, month] = period.slice(0, 10).split('-').map(Number);
  const name = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(
    new Date(year!, month! - 1, 1),
  );
  return `${name} ${year}`;
}

/** The company works on Chile's clock: a report opened at 23:30 on the 14th is the 14th
 * to the people who opened it, however the server's UTC timestamp reads. */
const COMPANY_TIME_ZONE = 'America/Santiago';

/** "2026-09-14" — the calendar day of a timestamp, read in the company's timezone. */
export function companyDay(timestamp: string): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

/** Mirrors ExpenseReportsService's own check (budget-control-api): a rendición spans
 * however many weeks it takes, possibly across months, so the only real constraint left
 * on an expense's date is that it isn't in the future. `undefined` when fine or blank. */
export function expenseDateError(date: string, today: string): string | undefined {
  if (!date) return undefined;
  if (date > today) return 'No puede ser una fecha futura.';
  return undefined;
}

/** The first problem among several receipts, or `undefined` when they are all fine. */
export function receiptFilesError(
  files: { name?: string; type: string; size: number }[],
): string | undefined {
  for (const file of files) {
    const problem = receiptFileError(file);
    if (problem) return file.name ? `${file.name}: ${problem}` : problem;
  }
  return undefined;
}

/** The expenses that still have no receipt. A report can only be closed once every
 * expense has at least one — mirrors the API's rule, which is what enforces it. */
export function expensesMissingReceipt<T extends { attachments?: unknown[] | null }>(
  lines: T[],
): T[] {
  return lines.filter((line) => !line.attachments || line.attachments.length === 0);
}

/** A receipt is usually a photo of a boleta, so JPEG and PNG are fine alongside PDF. */
export function receiptFileError(
  file: { type: string; size: number } | undefined,
): string | undefined {
  if (!file) return undefined;
  if (!RECEIPT_TYPES.includes(file.type)) return 'Solo se aceptan PDF, JPG o PNG.';
  if (file.size > MAX_RECEIPT_BYTES) return 'El archivo supera los 10MB.';
  return undefined;
}
