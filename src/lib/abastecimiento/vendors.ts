import type { components } from './api/schema';
import { isBank } from './banks';

export type Vendor = components['schemas']['Vendor'];
export type VendorContact = components['schemas']['VendorContact'];
export type VendorPaymentAccount = components['schemas']['VendorPaymentAccount'];
export type VendorCategory = components['schemas']['VendorCategory'];
export type VendorMissingField = components['schemas']['VendorMissingField'];
type CreateBody = components['schemas']['CreateVendorRequest'];
type UpdateBody = components['schemas']['UpdateVendorRequest'];

// The regions the vendor form offers, from north to south, are those of `lib/territory.ts`.
export { REGIONS } from './territory';

/** How a vendor is invoiced, as the form offers it: there is no "Boleta", a purchase order is not
 * made against a plain receipt. */
export const MODALITIES = ['Factura', 'Boleta de honorarios', 'Otro'];

/** How a vendor delivers: right away, or the whole payment on delivery. */
export const DELIVERY_TERMS = ['Inmediata', 'Pago Final Contra Entrega'];

export const ACCOUNT_TYPES = ['Corriente', 'Vista', 'Ahorro', 'RUT'];

/** The credit choices: cash and the usual 30 and 60 days (any other number already saved shows
 * as it is). The value is the days as text, '' being "not said". */
export function creditChoices(current: string): { value: string; label: string }[] {
  const choices = [
    { value: '', label: 'Elige una condición' },
    { value: '0', label: 'Contado' },
    { value: '30', label: 'Crédito 30 días' },
    { value: '60', label: 'Crédito 60 días' },
  ];
  if (current !== '' && !choices.some((choice) => choice.value === current)) {
    choices.push({ value: current, label: `Crédito ${current} días` });
  }
  return choices;
}

/** "Contado", "Crédito a 30 días", or nothing when it is not said: how a purchase order writes
 * the way a vendor is paid. */
export function creditText(days: number | null | undefined): string {
  if (days === null || days === undefined) return '';
  return days === 0 ? 'Contado' : `Crédito a ${days} días`;
}

/** How a vendor is paid, short enough for a table: "Contado", "30 días", or a dash. */
export function creditShort(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  return days === 0 ? 'Contado' : `${days} días`;
}

export interface ContactValues {
  /** Only for React: what keeps a row itself while others are added or removed. */
  key: string;
  name: string;
  phone: string;
  email: string;
  role: string;
}

export interface AccountValues {
  /** Only for React, like the key of a contact. */
  key: string;
  recipientName: string;
  recipientTaxId: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  email: string;
}

export interface VendorFormValues {
  name: string;
  taxId: string;
  legalName: string;
  businessActivity: string;
  /** The names of the categories the vendor belongs to. */
  categories: string[];
  /** Days of credit as text; '' is not said, '0' is cash. */
  creditDays: string;
  address: string;
  comuna: string;
  region: string;
  defaultModality: string;
  defaultDeliveryTerms: string;
  /** The book of contacts; the first is the main one. */
  contacts: ContactValues[];
  /** The book of payment accounts; the first is the main one. */
  accounts: AccountValues[];
}

let counter = 0;
export function emptyContact(): ContactValues {
  counter += 1;
  return { key: `contact-${counter}`, name: '', phone: '', email: '', role: '' };
}

export function emptyAccount(): AccountValues {
  counter += 1;
  return {
    key: `account-${counter}`,
    recipientName: '',
    recipientTaxId: '',
    bankName: '',
    accountType: '',
    accountNumber: '',
    email: '',
  };
}

/** A new vendor starts with a row of each book, since each needs at least one. */
export function emptyVendorForm(name = ''): VendorFormValues {
  return {
    name,
    taxId: '',
    legalName: '',
    businessActivity: '',
    categories: [],
    creditDays: '',
    address: '',
    comuna: '',
    region: '',
    defaultModality: '',
    defaultDeliveryTerms: '',
    contacts: [emptyContact()],
    accounts: [emptyAccount()],
  };
}

/** The form of a vendor that is saved, to edit it. */
export function vendorToForm(vendor: Vendor): VendorFormValues {
  const text = (value: string | null | undefined) => value ?? '';
  const contacts = [...(vendor.contacts ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((contact) => ({
      ...emptyContact(),
      name: contact.name,
      phone: text(contact.phone),
      email: text(contact.email),
      role: text(contact.role),
    }));
  const accounts = [...(vendor.paymentAccounts ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((account) => ({
      ...emptyAccount(),
      recipientName: text(account.recipientName),
      recipientTaxId: text(account.recipientTaxId),
      bankName: text(account.bankName),
      accountType: text(account.accountType),
      accountNumber: text(account.accountNumber),
      email: text(account.email),
    }));
  return {
    name: vendor.name,
    taxId: text(vendor.taxId),
    legalName: text(vendor.legalName),
    businessActivity: text(vendor.businessActivity),
    categories: (vendor.categories ?? []).map((category) => category.name),
    creditDays:
      vendor.creditDays === null || vendor.creditDays === undefined
        ? ''
        : String(vendor.creditDays),
    address: text(vendor.address),
    comuna: text(vendor.comuna),
    region: text(vendor.region),
    defaultModality: text(vendor.defaultModality),
    defaultDeliveryTerms: text(vendor.defaultDeliveryTerms),
    // A legacy vendor without them still shows a row to fill in.
    contacts: contacts.length > 0 ? contacts : [emptyContact()],
    accounts: accounts.length > 0 ? accounts : [emptyAccount()],
  };
}

/** A contact row with nothing in it is not a contact. */
function isBlank(contact: ContactValues): boolean {
  return (
    !contact.name.trim() && !contact.phone.trim() && !contact.email.trim() && !contact.role.trim()
  );
}

/** Same for an account row. */
function isBlankAccount(account: AccountValues): boolean {
  return (
    !account.recipientName.trim() &&
    !account.recipientTaxId.trim() &&
    !account.bankName.trim() &&
    !account.accountType.trim() &&
    !account.accountNumber.trim() &&
    !account.email.trim()
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the form still lacks, in words: it can be saved when this is empty. Everything is
 * required but the giro, and the role of a contact. */
export function vendorFormProblems(values: VendorFormValues): string[] {
  const problems: string[] = [];
  const required: [string, string][] = [
    [values.name, 'el nombre del proveedor'],
    [values.taxId, 'el RUT'],
    [values.legalName, 'la razón social'],
    [values.address, 'la dirección'],
    [values.region, 'la región'],
    [values.comuna, 'la comuna'],
    [values.defaultModality, 'la modalidad habitual'],
    [values.defaultDeliveryTerms, 'la entrega habitual'],
  ];
  for (const [value, what] of required) {
    if (!value.trim()) problems.push(`Falta ${what}.`);
  }
  if (values.creditDays === '') problems.push('Falta la condición de pago.');
  if (values.categories.length === 0) problems.push('Elige al menos una categoría.');

  const contacts = values.contacts.filter((contact) => !isBlank(contact));
  if (contacts.length === 0) problems.push('Agrega al menos un contacto.');
  contacts.forEach((contact, index) => {
    const who = contact.name.trim() || `El contacto ${index + 1}`;
    if (!contact.name.trim()) problems.push(`${who}: falta el nombre.`);
    if (!contact.phone.trim()) problems.push(`${who}: falta el teléfono.`);
    if (!contact.email.trim()) problems.push(`${who}: falta el correo.`);
    else if (!EMAIL.test(contact.email.trim())) problems.push(`${who}: el correo no es válido.`);
  });

  const accounts = values.accounts.filter((account) => !isBlankAccount(account));
  if (accounts.length === 0) problems.push('Agrega al menos una cuenta de pago.');
  accounts.forEach((account, index) => {
    const which = accounts.length > 1 ? `La cuenta ${index + 1}` : 'La cuenta de pago';
    if (!account.recipientName.trim()) problems.push(`${which}: falta el nombre del destinatario.`);
    if (!account.recipientTaxId.trim()) problems.push(`${which}: falta el RUT del destinatario.`);
    if (!account.bankName.trim()) problems.push(`${which}: falta el banco.`);
    else if (!isBank(account.bankName)) {
      problems.push(`${which}: el banco tiene que ser uno de la lista.`);
    }
    if (!account.accountType.trim()) problems.push(`${which}: falta el tipo de cuenta.`);
    if (!account.accountNumber.trim()) problems.push(`${which}: falta el número de cuenta.`);
    if (!account.email.trim()) problems.push(`${which}: falta el correo para el comprobante.`);
    else if (!EMAIL.test(account.email.trim())) {
      problems.push(`${which}: el correo para el comprobante no es válido.`);
    }
  });
  return problems;
}

/**
 * What the form says as the request. The two books always go whole, without the rows left
 * blank; an edit sends the plain fields as they are, so what is cleared is caught by the form's
 * own problems before the API's.
 */
export function vendorFormBody(values: VendorFormValues, mode: 'create'): CreateBody;
export function vendorFormBody(values: VendorFormValues, mode: 'update'): UpdateBody;
export function vendorFormBody(
  values: VendorFormValues,
  mode: 'create' | 'update',
): CreateBody | UpdateBody {
  const empty = mode === 'create' ? undefined : null;
  return {
    name: values.name.trim(),
    taxId: values.taxId.trim() || undefined,
    legalName: values.legalName.trim() || empty,
    businessActivity: values.businessActivity.trim() || empty,
    address: values.address.trim() || empty,
    region: values.region.trim() || empty,
    comuna: values.comuna.trim() || empty,
    defaultModality: values.defaultModality.trim() || empty,
    defaultDeliveryTerms: values.defaultDeliveryTerms.trim() || empty,
    creditDays: values.creditDays === '' ? empty : Number(values.creditDays),
    categories: values.categories,
    contacts: values.contacts
      .filter((contact) => !isBlank(contact))
      .map((contact) => ({
        name: contact.name.trim(),
        phone: contact.phone.trim() || null,
        email: contact.email.trim() || null,
        role: contact.role.trim() || null,
      })),
    paymentAccounts: values.accounts
      .filter((account) => !isBlankAccount(account))
      .map((account) => ({
        recipientName: account.recipientName.trim(),
        recipientTaxId: account.recipientTaxId.trim(),
        bankName: account.bankName.trim(),
        accountType: account.accountType.trim(),
        accountNumber: account.accountNumber.trim(),
        email: account.email.trim(),
      })),
  } as CreateBody | UpdateBody;
}

/** What a vendor still lacks, in words, for the badge on a vendor that was saved before the
 * data was required. */
const MISSING_LABELS: Record<VendorMissingField, string> = {
  name: 'nombre',
  taxId: 'RUT',
  legalName: 'razón social',
  address: 'dirección',
  region: 'región',
  comuna: 'comuna',
  categories: 'categorías',
  creditDays: 'condición de pago',
  defaultModality: 'modalidad habitual',
  defaultDeliveryTerms: 'entrega habitual',
  contacts: 'contactos',
  paymentAccounts: 'cuenta de pago',
};

export function missingLabels(vendor: Pick<Vendor, 'incompleteFields'>): string[] {
  return (vendor.incompleteFields ?? []).map((field) => MISSING_LABELS[field] ?? field);
}

/** The main contact of a vendor: the first of its book. */
export function mainContact(vendor: Pick<Vendor, 'contacts'>): VendorContact | undefined {
  return [...(vendor.contacts ?? [])].sort((a, b) => a.position - b.position)[0];
}

/** The main account of a vendor: the first of its book. */
export function mainAccount(
  vendor: Pick<Vendor, 'paymentAccounts'>,
): VendorPaymentAccount | undefined {
  return [...(vendor.paymentAccounts ?? [])].sort((a, b) => a.position - b.position)[0];
}

/** Moves a contact to the top of the book, which makes it the main one. */
export function makeMain(contacts: ContactValues[], key: string): ContactValues[] {
  const chosen = contacts.find((contact) => contact.key === key);
  return chosen ? [chosen, ...contacts.filter((contact) => contact.key !== key)] : contacts;
}

/** Same for an account. */
export function makeMainAccount(accounts: AccountValues[], key: string): AccountValues[] {
  const chosen = accounts.find((account) => account.key === key);
  return chosen ? [chosen, ...accounts.filter((account) => account.key !== key)] : accounts;
}

/**
 * A new account for when the vendor changes where it is paid: it starts as a copy of the main
 * one (the recipient and the RUT are usually the same) and is put first, so it is the main one.
 * The old account stays below it. When the book is empty it is just a blank account.
 */
export function addAccountAsMain(accounts: AccountValues[]): AccountValues[] {
  const current = accounts[0];
  const created = emptyAccount();
  if (current) {
    created.recipientName = current.recipientName;
    created.recipientTaxId = current.recipientTaxId;
    created.email = current.email;
  }
  return [created, ...accounts];
}

/** The pool's spelling of a name when it is already there (whatever the case), else the name
 * cleaned of extra spaces; '' when there is nothing in it. */
export function canonicalCategory(name: string, pool: string[]): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean === '') return '';
  return pool.find((existing) => existing.toLowerCase() === clean.toLowerCase()) ?? clean;
}

/** The selection with the category added, unless it is already in it (whatever the case). */
export function addCategory(selected: string[], name: string, pool: string[]): string[] {
  const canonical = canonicalCategory(name, pool);
  if (canonical === '') return selected;
  if (selected.some((existing) => existing.toLowerCase() === canonical.toLowerCase())) {
    return selected;
  }
  return [...selected, canonical];
}

export function removeCategory(selected: string[], name: string): string[] {
  return selected.filter((existing) => existing !== name);
}

/** The categories of the pool not chosen yet, to offer as the ones to add. */
export function remainingCategories(pool: string[], selected: string[]): string[] {
  const chosen = new Set(selected.map((name) => name.toLowerCase()));
  return pool.filter((name) => !chosen.has(name.toLowerCase()));
}

/** The categories chosen as a filter, as the URL keeps them: ids separated by commas, without
 * repeats or blanks. */
export function parseCategoryParam(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

/** The same, to put them in the URL: nothing when none is chosen. */
export function categoryParam(ids: string[]): string | undefined {
  return ids.length > 0 ? ids.join(',') : undefined;
}

/**
 * Which of the ids in the URL are categories of the pool (one that was removed since is dropped,
 * so a stale link does not filter by something that no longer exists) and their names, in the
 * order of the URL.
 */
export function chosenCategories(
  ids: string[],
  pool: Pick<VendorCategory, 'id' | 'name'>[],
): { id: string; name: string }[] {
  return ids.flatMap((id) => {
    const found = pool.find((category) => category.id === id);
    return found ? [{ id: found.id, name: found.name }] : [];
  });
}

/** The ids after the names of the filter's picker were changed: the picker works with names, the
 * URL with ids. A name that is not in the pool is ignored. */
export function idsOfNames(names: string[], pool: Pick<VendorCategory, 'id' | 'name'>[]): string[] {
  return names.flatMap((name) => {
    const found = pool.find((category) => category.name.toLowerCase() === name.toLowerCase());
    return found ? [found.id] : [];
  });
}
