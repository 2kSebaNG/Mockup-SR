import { isBank } from './banks';
import {
  emptyAccount,
  vendorFormBody,
  vendorFormProblems,
  vendorToForm,
  DELIVERY_TERMS,
  type AccountValues,
  type Vendor,
  type VendorFormValues,
  type VendorPaymentAccount,
} from './vendors';

/** The payment block an order carries (and the PDF prints), as the form keeps it. */
export interface OrderPayment {
  paymentRecipientName: string;
  paymentRecipientTaxId: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountEmail: string;
}

export const NO_PAYMENT: OrderPayment = {
  paymentRecipientName: '',
  paymentRecipientTaxId: '',
  bankName: '',
  bankAccountType: '',
  bankAccountNumber: '',
  bankAccountEmail: '',
};

/** "Scotiabank · Corriente · 984549571", and who it is to when that is told. */
export function accountLabel(account: VendorPaymentAccount): string {
  const where = [account.bankName, account.accountType, account.accountNumber]
    .filter(Boolean)
    .join(' · ');
  const who = account.recipientName ? ` — ${account.recipientName}` : '';
  return `${where || 'Cuenta sin datos'}${who}`;
}

/** What an order says of its payment when it pays into this account. */
export function paymentFromAccount(account: VendorPaymentAccount): OrderPayment {
  return {
    paymentRecipientName: account.recipientName ?? '',
    paymentRecipientTaxId: account.recipientTaxId ?? '',
    bankName: account.bankName ?? '',
    bankAccountType: account.accountType ?? '',
    bankAccountNumber: account.accountNumber ?? '',
    bankAccountEmail: account.email ?? '',
  };
}

/** Same, for an account that is being typed in and is not saved yet. */
export function paymentFromNewAccount(account: AccountValues): OrderPayment {
  return {
    paymentRecipientName: account.recipientName,
    paymentRecipientTaxId: account.recipientTaxId,
    bankName: account.bankName,
    bankAccountType: account.accountType,
    bankAccountNumber: account.accountNumber,
    bankAccountEmail: account.email,
  };
}

/** The account of the vendor an order's payment block already is, if it is one of them. */
export function accountMatching(
  vendor: Pick<Vendor, 'paymentAccounts'>,
  payment: OrderPayment,
): VendorPaymentAccount | undefined {
  if (!payment.bankName && !payment.bankAccountNumber) return undefined;
  return (vendor.paymentAccounts ?? []).find(
    (account) =>
      (account.bankName ?? '') === payment.bankName &&
      (account.accountNumber ?? '') === payment.bankAccountNumber &&
      (account.recipientTaxId ?? '') === payment.paymentRecipientTaxId,
  );
}

/**
 * The account to type in when the vendor changes where it is paid: the recipient's name and RUT
 * (and the e-mail for the proof) come loaded, from the main account or, when it has none, from the
 * vendor itself, and can be changed; the bank details are left to fill in.
 */
export function newAccountFor(
  vendor: Pick<Vendor, 'name' | 'legalName' | 'taxId' | 'paymentAccounts'>,
): AccountValues {
  const main = [...(vendor.paymentAccounts ?? [])].sort((a, b) => a.position - b.position)[0];
  const account = emptyAccount();
  account.recipientName = main?.recipientName ?? vendor.legalName ?? vendor.name;
  account.recipientTaxId = main?.recipientTaxId ?? vendor.taxId ?? '';
  account.email = main?.email ?? '';
  return account;
}

/** What an order still lacks of what every order carries, in words. */
export function orderingProblems(categories: string[], deliveryTerms: string): string[] {
  const problems: string[] = [];
  if (categories.length === 0) problems.push('Elige al menos una categoría para esta OC.');
  if (!DELIVERY_TERMS.includes(deliveryTerms)) problems.push('Elige la entrega de esta OC.');
  return problems;
}

/** What the vendor would be after the changes made in the order: the form it is edited in (or its
 * own, as saved), with the new account first so it is the main one. */
export function vendorAfterChanges(
  vendor: Vendor,
  edited: VendorFormValues | null,
  newAccount: AccountValues | null,
): VendorFormValues {
  const base = edited ?? vendorToForm(vendor);
  return newAccount ? { ...base, accounts: [newAccount, ...base.accounts] } : base;
}

function signature(values: VendorFormValues): string {
  return JSON.stringify(vendorFormBody(values, 'update'));
}

/** Whether the vendor has to be saved before the order: a new account, or edits that differ from
 * what is saved. */
export function vendorChanged(
  vendor: Vendor,
  edited: VendorFormValues | null,
  newAccount: AccountValues | null,
): boolean {
  if (newAccount) return true;
  return edited !== null && signature(edited) !== signature(vendorToForm(vendor));
}

/**
 * What stops the vendor from being saved with the changes made, in words. A vendor from before
 * the data was required has to be completed here too, whether or not it was touched, since the
 * order is made against it.
 */
export function vendorProblems(
  vendor: Vendor,
  edited: VendorFormValues | null,
  newAccount: AccountValues | null,
): string[] {
  const incomplete = (vendor.incompleteFields ?? []).length > 0;
  if (!incomplete && !vendorChanged(vendor, edited, newAccount)) return [];
  return vendorFormProblems(vendorAfterChanges(vendor, edited, newAccount));
}

// ---------------------------------------------------------------------------------------------
// What an order takes from its vendor, and where it departs from it.
//
// A vendor brings a habitual modality, payment condition, categories, main contact and main
// payment account. The order starts from them; any of them can be an exception for that order
// alone, with its own checkbox, without touching the vendor. The form keeps the values the order
// really has (they are what is sent), and works out which of them are exceptions by comparing
// with what the vendor brings, exactly as the API does when it saves the order.
// ---------------------------------------------------------------------------------------------

export interface OrderContact {
  name: string;
  phone: string;
  email: string;
}

/** What an order says of its vendor-dependent terms, as the form keeps them. */
export interface OrderTerms {
  modality: string;
  /** Days of credit as text; '' is not said, '0' is cash. */
  creditDays: string;
  categories: string[];
  contact: OrderContact;
  /** Chosen in every order (not an exception to anything). */
  deliveryTerms: string;
  payment: OrderPayment;
}

export const NO_CONTACT: OrderContact = { name: '', phone: '', email: '' };

export const EMPTY_TERMS: OrderTerms = {
  modality: '',
  creditDays: '',
  categories: [],
  contact: NO_CONTACT,
  deliveryTerms: '',
  payment: NO_PAYMENT,
};

/** The fields of an order that can be an exception to its vendor. */
export type TermsField = 'modality' | 'creditDays' | 'categories' | 'account' | 'contact';

export const TERMS_FIELDS: TermsField[] = [
  'modality',
  'creditDays',
  'categories',
  'account',
  'contact',
];

/** The main contact of a vendor (the first of its book) as an order contact. */
export function contactOf(vendor: Pick<Vendor, 'contacts'>): OrderContact {
  const main = [...(vendor.contacts ?? [])].sort((a, b) => a.position - b.position)[0];
  return main ? { name: main.name, phone: main.phone ?? '', email: main.email ?? '' } : NO_CONTACT;
}

/** What the vendor brings to an order: the values it starts from (the delivery is left for each
 * order to choose, so it is not here). */
export function vendorTerms(vendor: Vendor): Omit<OrderTerms, 'deliveryTerms'> {
  const account = [...(vendor.paymentAccounts ?? [])].sort((a, b) => a.position - b.position)[0];
  return {
    modality: vendor.defaultModality ?? '',
    creditDays:
      vendor.creditDays === null || vendor.creditDays === undefined
        ? ''
        : String(vendor.creditDays),
    categories: (vendor.categories ?? []).map((category) => category.name),
    contact: contactOf(vendor),
    payment: account ? paymentFromAccount(account) : NO_PAYMENT,
  };
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** In what the order departs from what its vendor brings. The same comparison as the API makes. A
 * field the order says nothing about, or the vendor has nothing for, is not an exception. */
export function exceptionsOfTerms(vendor: Vendor, terms: OrderTerms): TermsField[] {
  const defaults = vendorTerms(vendor);
  const found: TermsField[] = [];
  if (
    defaults.modality !== '' &&
    terms.modality !== '' &&
    !same(terms.modality, defaults.modality)
  ) {
    found.push('modality');
  }
  if (
    defaults.creditDays !== '' &&
    terms.creditDays !== '' &&
    terms.creditDays !== defaults.creditDays
  ) {
    found.push('creditDays');
  }
  const own = new Set(defaults.categories.map((name) => name.toLowerCase()));
  if (terms.categories.some((name) => !own.has(name.toLowerCase()))) found.push('categories');
  const pay = terms.payment;
  const mainPay = defaults.payment;
  if (
    (mainPay.bankName || mainPay.bankAccountNumber) &&
    (pay.bankName || pay.bankAccountNumber) &&
    !(
      same(pay.bankName, mainPay.bankName) &&
      same(pay.bankAccountNumber, mainPay.bankAccountNumber) &&
      same(pay.paymentRecipientTaxId, mainPay.paymentRecipientTaxId)
    )
  ) {
    found.push('account');
  }
  const c = terms.contact;
  const main = defaults.contact;
  if (
    (main.name || main.phone || main.email) &&
    (c.name || c.phone || c.email) &&
    !(same(c.name, main.name) && same(c.phone, main.phone) && same(c.email, main.email))
  ) {
    found.push('contact');
  }
  return found;
}

/** The order with one field back to what its vendor brings: the exception withdrawn. */
export function resetTerm(vendor: Vendor, terms: OrderTerms, field: TermsField): OrderTerms {
  const defaults = vendorTerms(vendor);
  switch (field) {
    case 'modality':
      return { ...terms, modality: defaults.modality };
    case 'creditDays':
      return { ...terms, creditDays: defaults.creditDays };
    case 'categories':
      return { ...terms, categories: defaults.categories };
    case 'account':
      return { ...terms, payment: defaults.payment };
    case 'contact':
      return { ...terms, contact: defaults.contact };
  }
}

/** The order with every field that is not an exception following what its vendor brings now: a
 * vendor corrected from the order, or loaded late, is reflected in what is not an exception. */
export function followVendor(
  vendor: Vendor,
  terms: OrderTerms,
  unlocked: Record<TermsField, boolean>,
): OrderTerms {
  return TERMS_FIELDS.reduce(
    (next, field) => (unlocked[field] ? next : resetTerm(vendor, next, field)),
    terms,
  );
}

/** What a saved order says of its terms, to take them back into the form. */
export function termsFromMetadata(metadata: Record<string, unknown>): OrderTerms {
  const text = (key: string) =>
    typeof metadata[key] === 'string' ? (metadata[key] as string) : '';
  return {
    modality: text('modality'),
    creditDays: typeof metadata["creditDays"] === 'number' ? String(metadata["creditDays"]) : '',
    categories: Array.isArray(metadata["categories"])
      ? metadata["categories"].filter((name): name is string => typeof name === 'string')
      : [],
    contact: {
      name: text('contactName'),
      phone: text('contactPhone'),
      email: text('contactEmail'),
    },
    deliveryTerms: text('deliveryTerms'),
    payment: {
      paymentRecipientName: text('paymentRecipientName'),
      paymentRecipientTaxId: text('paymentRecipientTaxId'),
      bankName: text('bankName'),
      bankAccountType: text('bankAccountType'),
      bankAccountNumber: text('bankAccountNumber'),
      bankAccountEmail: text('bankAccountEmail'),
    },
  };
}

/** What is wrong with a payment account that is only for this order (the vendor rules do not look
 * at it, since it is not saved in the vendor), in words. */
export function oneOffAccountProblems(account: AccountValues): string[] {
  const who = 'Cuenta solo para esta OC';
  const problems: string[] = [];
  if (!account.recipientName.trim()) problems.push(`${who}: falta el nombre del destinatario.`);
  if (!account.recipientTaxId.trim()) problems.push(`${who}: falta el RUT del destinatario.`);
  if (!account.bankName.trim()) problems.push(`${who}: falta el banco.`);
  else if (!isBank(account.bankName)) {
    problems.push(`${who}: el banco tiene que ser uno de la lista.`);
  }
  if (!account.accountType.trim()) problems.push(`${who}: falta el tipo de cuenta.`);
  if (!account.accountNumber.trim()) problems.push(`${who}: falta el número de cuenta.`);
  if (!account.email.trim()) problems.push(`${who}: falta el correo para el comprobante.`);
  return problems;
}

const EXCEPTION_LABELS: Record<TermsField, string> = {
  modality: 'modalidad',
  creditDays: 'condición de pago',
  categories: 'categorías',
  account: 'cuenta de pago',
  contact: 'contacto',
};

/** In words, in what a saved order departs from its vendor ("modalidad, cuenta de pago"), or null
 * when it does not (or when the order says nothing, as one from before did not). */
export function exceptionText(exceptions: unknown): string | null {
  if (!Array.isArray(exceptions)) return null;
  const labels = TERMS_FIELDS.filter((field) => exceptions.includes(field)).map(
    (field) => EXCEPTION_LABELS[field],
  );
  return labels.length > 0 ? labels.join(', ') : null;
}
