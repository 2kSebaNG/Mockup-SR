import {
  EMPTY_TERMS,
  TERMS_FIELDS,
  contactOf,
  exceptionText,
  exceptionsOfTerms,
  followVendor,
  newAccountFor,
  oneOffAccountProblems,
  resetTerm,
  termsFromMetadata,
  vendorTerms,
  type OrderTerms,
  type TermsField,
} from '@/lib/abastecimiento/vendor-in-order';
import type { Vendor } from '@/lib/abastecimiento/vendors';

const vendor: Vendor = {
  id: 'v1',
  name: 'MaqRent',
  normalizedName: 'maqrent',
  taxId: '76.123.456-7',
  active: true,
  legalName: 'MaqRent SpA',
  creditDays: 30,
  defaultModality: 'Factura',
  defaultDeliveryTerms: 'Inmediata',
  categories: [
    { id: 'k1', name: 'Servicios' },
    { id: 'k2', name: 'Materiales' },
  ],
  contacts: [
    { id: 'c2', name: 'Luis', phone: '222', email: 'luis@x.cl', role: null, position: 1 },
    { id: 'c1', name: 'Ana', phone: '111', email: 'ana@x.cl', role: null, position: 0 },
  ],
  paymentAccounts: [
    {
      id: 'a2',
      recipientName: 'Otra',
      recipientTaxId: '9.999.999-9',
      bankName: 'Scotiabank',
      accountType: 'Vista',
      accountNumber: '2000',
      email: 'o@x.cl',
      position: 1,
    },
    {
      id: 'a1',
      recipientName: 'MaqRent SpA',
      recipientTaxId: '76.123.456-7',
      bankName: 'Banco de Chile',
      accountType: 'Corriente',
      accountNumber: '1000',
      email: 'p@x.cl',
      position: 0,
    },
  ],
  incompleteFields: [],
};

/** An order that is exactly what its vendor brings. */
const asBrought = (): OrderTerms => ({ ...vendorTerms(vendor), deliveryTerms: 'Inmediata' });

const locked: Record<TermsField, boolean> = {
  modality: false,
  creditDays: false,
  categories: false,
  account: false,
  contact: false,
};

describe('what a vendor brings to an order', () => {
  it('is its habitual modality and payment condition, its categories and its main contact and account', () => {
    expect(vendorTerms(vendor)).toEqual({
      modality: 'Factura',
      creditDays: '30',
      categories: ['Servicios', 'Materiales'],
      contact: { name: 'Ana', phone: '111', email: 'ana@x.cl' },
      payment: {
        paymentRecipientName: 'MaqRent SpA',
        paymentRecipientTaxId: '76.123.456-7',
        bankName: 'Banco de Chile',
        bankAccountType: 'Corriente',
        bankAccountNumber: '1000',
        bankAccountEmail: 'p@x.cl',
      },
    });
  });

  it('tells cash from no payment condition, and copes with a vendor that has nothing', () => {
    expect(vendorTerms({ ...vendor, creditDays: 0 }).creditDays).toBe('0');
    const bare: Vendor = { id: 'v', name: 'X', normalizedName: 'x', taxId: null, active: true };
    expect(vendorTerms(bare)).toMatchObject({ modality: '', creditDays: '', categories: [] });
    expect(contactOf(bare)).toEqual({ name: '', phone: '', email: '' });
  });
});

describe('where an order departs from its vendor', () => {
  it('finds nothing in an order that is what its vendor brings', () => {
    expect(exceptionsOfTerms(vendor, asBrought())).toEqual([]);
  });

  it('finds each exception on its own', () => {
    expect(exceptionsOfTerms(vendor, { ...asBrought(), modality: 'Otro' })).toEqual(['modality']);
    expect(exceptionsOfTerms(vendor, { ...asBrought(), creditDays: '0' })).toEqual(['creditDays']);
    expect(
      exceptionsOfTerms(vendor, { ...asBrought(), categories: ['Servicios', 'Nueva'] }),
    ).toEqual(['categories']);
    expect(
      exceptionsOfTerms(vendor, {
        ...asBrought(),
        contact: { name: 'Luis', phone: '222', email: 'luis@x.cl' },
      }),
    ).toEqual(['contact']);
  });

  it('counts the second account of the vendor as an exception: it is not the main one', () => {
    const terms = asBrought();
    terms.payment = {
      ...terms.payment,
      bankName: 'Scotiabank',
      bankAccountNumber: '2000',
      paymentRecipientTaxId: '9.999.999-9',
    };
    expect(exceptionsOfTerms(vendor, terms)).toEqual(['account']);
  });

  it('does not count a subset of its categories, nor what the order has not said yet', () => {
    expect(exceptionsOfTerms(vendor, { ...asBrought(), categories: ['Servicios'] })).toEqual([]);
    expect(exceptionsOfTerms(vendor, { ...EMPTY_TERMS })).toEqual([]);
  });
});

describe('withdrawing an exception', () => {
  const departed: OrderTerms = {
    ...asBrought(),
    modality: 'Otro',
    creditDays: '0',
    categories: ['Nueva'],
    contact: { name: 'Otro', phone: '1', email: 'o@x.cl' },
    payment: { ...asBrought().payment, bankName: 'Tenpo', bankAccountNumber: '1' },
  };

  it('puts one field back to what the vendor brings and leaves the others', () => {
    const back = resetTerm(vendor, departed, 'modality');
    expect(back.modality).toBe('Factura');
    expect(back.creditDays).toBe('0');
    expect(exceptionsOfTerms(vendor, back)).toEqual([
      'creditDays',
      'categories',
      'account',
      'contact',
    ]);
  });

  it('leaves no exception after resetting all of them', () => {
    const all = TERMS_FIELDS.reduce((terms, field) => resetTerm(vendor, terms, field), departed);
    expect(exceptionsOfTerms(vendor, all)).toEqual([]);
    expect(all.deliveryTerms).toBe('Inmediata');
  });

  it('keeps the exceptions that are unlocked while the rest follows the vendor', () => {
    const followed = followVendor(vendor, departed, { ...locked, modality: true });
    expect(followed.modality).toBe('Otro');
    expect(followed.creditDays).toBe('30');
    expect(followed.categories).toEqual(['Servicios', 'Materiales']);
  });

  it('follows a vendor that was corrected: what is not an exception changes with it', () => {
    const corrected = { ...vendor, defaultModality: 'Boleta de honorarios', creditDays: 60 };
    const followed = followVendor(corrected, asBrought(), locked);
    expect(followed.modality).toBe('Boleta de honorarios');
    expect(followed.creditDays).toBe('60');
  });
});

describe('taking a saved order back into the form', () => {
  it('reads its terms from the metadata, and nothing from a metadata without them', () => {
    expect(
      termsFromMetadata({
        modality: 'Otro',
        creditDays: 0,
        categories: ['A', 5, 'B'],
        contactName: 'Ana',
        contactPhone: '1',
        contactEmail: 'a@x.cl',
        deliveryTerms: 'Pago Final Contra Entrega',
        bankName: 'Tenpo',
        bankAccountNumber: '7',
      }),
    ).toMatchObject({
      modality: 'Otro',
      creditDays: '0',
      categories: ['A', 'B'],
      contact: { name: 'Ana', phone: '1', email: 'a@x.cl' },
      deliveryTerms: 'Pago Final Contra Entrega',
      payment: { bankName: 'Tenpo', bankAccountNumber: '7', paymentRecipientName: '' },
    });
    expect(termsFromMetadata({})).toEqual(EMPTY_TERMS);
  });
});

describe('an account that is only for this order', () => {
  it('has to be complete and with a bank of the list, like any other', () => {
    expect(oneOffAccountProblems(newAccountFor(vendor))).toEqual([
      'Cuenta solo para esta OC: falta el banco.',
      'Cuenta solo para esta OC: falta el tipo de cuenta.',
      'Cuenta solo para esta OC: falta el número de cuenta.',
    ]);
    const done = {
      ...newAccountFor(vendor),
      bankName: 'Banco BCI',
      accountType: 'Corriente',
      accountNumber: '42',
    };
    expect(oneOffAccountProblems(done)).toEqual([]);
    expect(oneOffAccountProblems({ ...done, bankName: 'BCI' })).toEqual([
      'Cuenta solo para esta OC: el banco tiene que ser uno de la lista.',
    ]);
  });
});

describe('exceptionText', () => {
  it('says in words where a saved order departs from its vendor, in the order of the fields', () => {
    expect(exceptionText(['account', 'modality'])).toBe('modalidad, cuenta de pago');
    expect(exceptionText(['categories', 'contact', 'creditDays'])).toBe(
      'condición de pago, categorías, contacto',
    );
  });

  it('says nothing for an order with none, or one that never recorded them', () => {
    expect(exceptionText([])).toBeNull();
    expect(exceptionText(undefined)).toBeNull();
    expect(exceptionText('modality')).toBeNull();
    expect(exceptionText(['inventada'])).toBeNull();
  });
});
