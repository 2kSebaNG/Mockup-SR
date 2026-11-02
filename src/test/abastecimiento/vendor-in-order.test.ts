import {
  accountLabel,
  accountMatching,
  newAccountFor,
  orderingProblems,
  paymentFromAccount,
  paymentFromNewAccount,
  vendorAfterChanges,
  vendorChanged,
  vendorProblems,
} from '@/lib/abastecimiento/vendor-in-order';
import { vendorToForm, type Vendor } from '@/lib/abastecimiento/vendors';

const vendor: Vendor = {
  id: 'v1',
  name: 'MaqRent',
  normalizedName: 'maqrent',
  taxId: '76.123.456-7',
  active: true,
  legalName: 'MaqRent SpA',
  creditDays: 30,
  address: 'Av. Siempre Viva 123',
  region: 'Región Metropolitana de Santiago',
  comuna: 'Santiago',
  defaultModality: 'Factura',
  defaultDeliveryTerms: 'Inmediata',
  categories: [{ id: 'k1', name: 'Servicios' }],
  contacts: [
    {
      id: 'c1',
      name: 'Ana',
      phone: '+56 9 1111 2222',
      email: 'ana@maqrent.cl',
      role: null,
      position: 0,
    },
  ],
  paymentAccounts: [
    {
      id: 'a1',
      recipientName: 'MaqRent SpA',
      recipientTaxId: '76.123.456-7',
      bankName: 'Scotiabank',
      accountType: 'Corriente',
      accountNumber: '123456',
      email: 'pagos@maqrent.cl',
      position: 0,
    },
    {
      id: 'a2',
      recipientName: 'MaqRent Antigua',
      recipientTaxId: '76.999.999-9',
      bankName: 'Banco Estado',
      accountType: 'Vista',
      accountNumber: '777',
      email: 'viejo@maqrent.cl',
      position: 1,
    },
  ],
  incompleteFields: [],
};

describe('the payment of an order', () => {
  it('describes an account by its bank, kind and number, and who it is to', () => {
    expect(accountLabel(vendor.paymentAccounts![0]!)).toBe(
      'Scotiabank · Corriente · 123456 — MaqRent SpA',
    );
    expect(accountLabel({ id: 'x', position: 0, recipientName: null, bankName: 'Estado' })).toBe(
      'Estado',
    );
    expect(accountLabel({ id: 'x', position: 0 })).toBe('Cuenta sin datos');
  });

  it('takes the payment block of the order from an account, saved or being typed', () => {
    expect(paymentFromAccount(vendor.paymentAccounts![1]!)).toEqual({
      paymentRecipientName: 'MaqRent Antigua',
      paymentRecipientTaxId: '76.999.999-9',
      bankName: 'Banco Estado',
      bankAccountType: 'Vista',
      bankAccountNumber: '777',
      bankAccountEmail: 'viejo@maqrent.cl',
    });
    const typed = { ...newAccountFor(vendor), bankName: 'Banco BCI', accountNumber: '42' };
    expect(paymentFromNewAccount(typed)).toMatchObject({
      paymentRecipientName: 'MaqRent SpA',
      bankName: 'Banco BCI',
      bankAccountNumber: '42',
    });
  });

  it('knows which account of the vendor an order already pays into', () => {
    const payment = paymentFromAccount(vendor.paymentAccounts![1]!);
    expect(accountMatching(vendor, payment)?.id).toBe('a2');
    expect(accountMatching(vendor, { ...payment, bankAccountNumber: '000' })).toBeUndefined();
    expect(
      accountMatching(vendor, { ...payment, bankName: '', bankAccountNumber: '' }),
    ).toBeUndefined();
  });

  it('loads the recipient and RUT of the main account into a new one, to be changed', () => {
    expect(newAccountFor(vendor)).toMatchObject({
      recipientName: 'MaqRent SpA',
      recipientTaxId: '76.123.456-7',
      email: 'pagos@maqrent.cl',
      bankName: '',
      accountType: '',
      accountNumber: '',
    });
  });

  it('loads them from the vendor itself when it has no account yet', () => {
    const bare = { ...vendor, paymentAccounts: [] };
    expect(newAccountFor(bare)).toMatchObject({
      recipientName: 'MaqRent SpA',
      recipientTaxId: '76.123.456-7',
      email: '',
    });
    expect(newAccountFor({ ...bare, legalName: null }).recipientName).toBe('MaqRent');
  });
});

describe('what every order carries', () => {
  it('asks for a category and one of the two deliveries', () => {
    expect(orderingProblems(['Servicios'], 'Inmediata')).toEqual([]);
    expect(orderingProblems(['Servicios'], 'Pago Final Contra Entrega')).toEqual([]);
    expect(orderingProblems([], '')).toEqual([
      'Elige al menos una categoría para esta OC.',
      'Elige la entrega de esta OC.',
    ]);
    expect(orderingProblems(['Servicios'], '15 días hábiles')).toEqual([
      'Elige la entrega de esta OC.',
    ]);
  });
});

describe('changing the vendor from the order', () => {
  it('has nothing to save when nothing was touched', () => {
    expect(vendorChanged(vendor, null, null)).toBe(false);
    expect(vendorChanged(vendor, vendorToForm(vendor), null)).toBe(false);
    expect(vendorProblems(vendor, null, null)).toEqual([]);
  });

  it('has to save an edit that differs from what is saved, and one that was undone is not one', () => {
    const edited = { ...vendorToForm(vendor), address: 'Otra 456' };
    expect(vendorChanged(vendor, edited, null)).toBe(true);
    expect(vendorChanged(vendor, { ...edited, address: vendor.address! }, null)).toBe(false);
  });

  it('puts a new account first, so it becomes the main one', () => {
    const account = { ...newAccountFor(vendor), bankName: 'Banco BCI', accountNumber: '42' };
    const after = vendorAfterChanges(vendor, null, account);
    expect(after.accounts.map((a) => a.bankName)).toEqual([
      'Banco BCI',
      'Scotiabank',
      'Banco Estado',
    ]);
    expect(vendorChanged(vendor, null, account)).toBe(true);
  });

  it('says what a new account still lacks before the vendor can be saved', () => {
    const account = newAccountFor(vendor);
    expect(vendorProblems(vendor, null, account)).toEqual([
      'La cuenta 1: falta el banco.',
      'La cuenta 1: falta el tipo de cuenta.',
      'La cuenta 1: falta el número de cuenta.',
    ]);
    const done = {
      ...account,
      bankName: 'Banco BCI',
      accountType: 'Corriente',
      accountNumber: '42',
    };
    expect(vendorProblems(vendor, null, done)).toEqual([]);
  });

  it('asks a vendor from before the rule to be completed, even when it was not touched', () => {
    const legacy: Vendor = {
      id: 'v2',
      name: 'Viejo',
      normalizedName: 'viejo',
      taxId: '1-9',
      active: true,
      incompleteFields: ['legalName', 'contacts'],
    };
    const problems = vendorProblems(legacy, null, null);
    expect(problems).toContain('Falta la razón social.');
    expect(problems).toContain('Agrega al menos un contacto.');
  });
});
