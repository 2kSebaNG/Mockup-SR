import {
  REGIONS,
  addAccountAsMain,
  addCategory,
  canonicalCategory,
  categoryParam,
  chosenCategories,
  idsOfNames,
  parseCategoryParam,
  creditChoices,
  creditShort,
  creditText,
  emptyAccount,
  emptyContact,
  emptyVendorForm,
  mainAccount,
  mainContact,
  makeMain,
  makeMainAccount,
  missingLabels,
  remainingCategories,
  removeCategory,
  vendorFormBody,
  vendorFormProblems,
  vendorToForm,
  type Vendor,
} from '@/lib/abastecimiento/vendors';

const vendor: Vendor = {
  id: 'v1',
  name: 'Serviminerals',
  normalizedName: 'serviminerals',
  taxId: '76.476.553-2',
  active: true,
  legalName: 'SERVIMINERALS LTDA.',
  businessActivity: 'Servicios mineros',
  creditDays: 30,
  address: 'Av. Industrial 123',
  comuna: 'Quilicura',
  region: 'Metropolitana de Santiago',
  defaultModality: 'Factura',
  defaultDeliveryTerms: 'Inmediata',
  categories: [
    { id: 'k1', name: 'Servicios' },
    { id: 'k2', name: 'Arriendo de equipos' },
  ],
  contacts: [
    {
      id: 'c2',
      name: 'Ana Soto',
      phone: '+56 9 8765 4321',
      email: 'ana@serviminerals.cl',
      role: 'Cobranza',
      position: 1,
    },
    {
      id: 'c1',
      name: 'Juan Pérez',
      phone: '+56 9 1234 5678',
      email: 'juan@serviminerals.cl',
      role: 'Ventas',
      position: 0,
    },
  ],
  paymentAccounts: [
    {
      id: 'a2',
      recipientName: 'SERVIMINERALS ANTIGUA',
      recipientTaxId: '76.476.553-2',
      bankName: 'Banco de Chile',
      accountType: 'Vista',
      accountNumber: '111',
      email: 'viejo@serviminerals.cl',
      position: 1,
    },
    {
      id: 'a1',
      recipientName: 'SERVIMINERALS LTDA.',
      recipientTaxId: '76.476.553-2',
      bankName: 'Scotiabank',
      accountType: 'Corriente',
      accountNumber: '984549571',
      email: 'ventas@serviminerals.cl',
      position: 0,
    },
  ],
  incompleteFields: [],
};

describe('the vendor form', () => {
  it('shows a saved vendor as it is, with the main contact and account first', () => {
    const form = vendorToForm(vendor);
    expect(form).toMatchObject({
      name: 'Serviminerals',
      taxId: '76.476.553-2',
      businessActivity: 'Servicios mineros',
      categories: ['Servicios', 'Arriendo de equipos'],
      creditDays: '30',
      defaultModality: 'Factura',
      defaultDeliveryTerms: 'Inmediata',
    });
    expect(form.contacts.map((contact) => [contact.name, contact.role])).toEqual([
      ['Juan Pérez', 'Ventas'],
      ['Ana Soto', 'Cobranza'],
    ]);
    expect(form.accounts.map((account) => [account.bankName, account.accountNumber])).toEqual([
      ['Scotiabank', '984549571'],
      ['Banco de Chile', '111'],
    ]);
  });

  it('gives a vendor from before the rule a row of each book to fill in', () => {
    const legacy: Vendor = {
      id: 'v3',
      name: 'Viejo',
      normalizedName: 'viejo',
      taxId: null,
      active: true,
    };
    const form = vendorToForm(legacy);
    expect(form.contacts).toHaveLength(1);
    expect(form.accounts).toHaveLength(1);
    expect(form.categories).toEqual([]);
  });

  it('tells cash from a vendor with no payment condition', () => {
    expect(vendorToForm({ ...vendor, creditDays: 0 }).creditDays).toBe('0');
    expect(vendorToForm({ ...vendor, creditDays: null }).creditDays).toBe('');
    expect(creditText(0)).toBe('Contado');
    expect(creditText(60)).toBe('Crédito a 60 días');
    expect(creditText(null)).toBe('');
    expect(creditShort(0)).toBe('Contado');
    expect(creditShort(30)).toBe('30 días');
    expect(creditShort(undefined)).toBe('—');
  });

  it('offers cash, 30 and 60 days, and keeps any other number already saved', () => {
    expect(creditChoices('').map((choice) => choice.label)).toEqual([
      'Elige una condición',
      'Contado',
      'Crédito 30 días',
      'Crédito 60 días',
    ]);
    expect(creditChoices('45').at(-1)).toEqual({ value: '45', label: 'Crédito 45 días' });
  });

  it('writes a new vendor with its books and categories, leaving the blank rows out', () => {
    const form = vendorToForm(vendor);
    form.contacts.push(emptyContact());
    form.accounts.push(emptyAccount());
    const body = vendorFormBody({ ...form, name: '  Nuevo  ', taxId: ' 1-9 ' }, 'create');
    expect(body).toMatchObject({
      name: 'Nuevo',
      taxId: '1-9',
      categories: ['Servicios', 'Arriendo de equipos'],
      creditDays: 30,
    });
    expect(body.contacts).toHaveLength(2);
    expect(body.paymentAccounts.map((account) => account.bankName)).toEqual([
      'Scotiabank',
      'Banco de Chile',
    ]);
  });

  it('leaves what is empty out on a new vendor and sends null on an edit', () => {
    const form = { ...vendorToForm(vendor), businessActivity: '  ', creditDays: '' };
    expect(vendorFormBody(form, 'create').businessActivity).toBeUndefined();
    expect(vendorFormBody(form, 'update')).toMatchObject({
      businessActivity: null,
      creditDays: null,
    });
    // Cash is a value, not an empty field.
    expect(vendorFormBody({ ...form, creditDays: '0' }, 'update').creditDays).toBe(0);
  });

  it('asks for everything but the giro, and nothing for a vendor that has it all', () => {
    expect(vendorFormProblems(vendorToForm(vendor))).toEqual([]);
    expect(vendorFormProblems({ ...vendorToForm(vendor), businessActivity: '' })).toEqual([]);
    expect(vendorFormProblems(emptyVendorForm())).toEqual([
      'Falta el nombre del proveedor.',
      'Falta el RUT.',
      'Falta la razón social.',
      'Falta la dirección.',
      'Falta la región.',
      'Falta la comuna.',
      'Falta la modalidad habitual.',
      'Falta la entrega habitual.',
      'Falta la condición de pago.',
      'Elige al menos una categoría.',
      'Agrega al menos un contacto.',
      'Agrega al menos una cuenta de pago.',
    ]);
  });

  it('says what a half-filled contact or account lacks, naming it when it can', () => {
    const form = vendorToForm(vendor);
    form.contacts.push(
      { ...emptyContact(), name: 'Pedro', phone: '123' },
      { ...emptyContact(), phone: '555', email: 'x' },
    );
    form.accounts.push({ ...emptyAccount(), bankName: 'Banco Estado', email: 'mal' });
    expect(vendorFormProblems(form)).toEqual([
      'Pedro: falta el correo.',
      'El contacto 4: falta el nombre.',
      'El contacto 4: el correo no es válido.',
      'La cuenta 3: falta el nombre del destinatario.',
      'La cuenta 3: falta el RUT del destinatario.',
      'La cuenta 3: falta el tipo de cuenta.',
      'La cuenta 3: falta el número de cuenta.',
      'La cuenta 3: el correo para el comprobante no es válido.',
    ]);
  });

  it('does not ask for the role of a contact', () => {
    const form = vendorToForm(vendor);
    form.contacts = form.contacts.map((contact) => ({ ...contact, role: '' }));
    expect(vendorFormProblems(form)).toEqual([]);
  });

  it('moves a contact to the top, which makes it the main one', () => {
    const contacts = [
      { ...emptyContact(), name: 'A' },
      { ...emptyContact(), name: 'B' },
      { ...emptyContact(), name: 'C' },
    ];
    expect(makeMain(contacts, contacts[2]!.key).map((contact) => contact.name)).toEqual([
      'C',
      'A',
      'B',
    ]);
    expect(makeMain(contacts, 'nope')).toBe(contacts);
  });

  it('knows the main contact and the main account, whatever order the books came in', () => {
    expect(mainContact(vendor)?.name).toBe('Juan Pérez');
    expect(mainContact({ contacts: [] })).toBeUndefined();
    expect(mainContact({})).toBeUndefined();
    expect(mainAccount(vendor)?.bankName).toBe('Scotiabank');
    expect(mainAccount({})).toBeUndefined();
  });

  it('has the sixteen regions of Chile', () => {
    expect(REGIONS).toHaveLength(16);
    expect(new Set(REGIONS).size).toBe(16);
  });
});

describe('the book of payment accounts', () => {
  it('moves an account to the top, which makes it the main one', () => {
    const accounts = vendorToForm(vendor).accounts;
    const reordered = makeMainAccount(accounts, accounts[1]!.key);
    expect(reordered.map((account) => account.bankName)).toEqual(['Banco de Chile', 'Scotiabank']);
    expect(makeMainAccount(accounts, 'nope')).toBe(accounts);
  });

  it('adds a new account as the main one, starting from the recipient of the old one', () => {
    const accounts = vendorToForm(vendor).accounts;
    const next = addAccountAsMain(accounts);
    expect(next).toHaveLength(3);
    expect(next[0]).toMatchObject({
      recipientName: 'SERVIMINERALS LTDA.',
      recipientTaxId: '76.476.553-2',
      email: 'ventas@serviminerals.cl',
      bankName: '',
      accountNumber: '',
    });
    expect(next.slice(1)).toEqual(accounts);
    expect(new Set(next.map((account) => account.key)).size).toBe(3);
  });

  it('adds a blank account to an empty book', () => {
    expect(addAccountAsMain([])).toHaveLength(1);
    expect(addAccountAsMain([])[0]!.bankName).toBe('');
  });
});

describe('the categories of a vendor', () => {
  const pool = ['Materiales', 'Arriendo de equipos', 'Servicios'];

  it('uses the pool spelling for a name that is already there, whatever its case', () => {
    expect(canonicalCategory('  materiales ', pool)).toBe('Materiales');
    expect(canonicalCategory('Nueva   categoría', pool)).toBe('Nueva categoría');
    expect(canonicalCategory('   ', pool)).toBe('');
  });

  it('adds a category once, and a new one as it is written', () => {
    expect(addCategory([], 'servicios', pool)).toEqual(['Servicios']);
    expect(addCategory(['Servicios'], 'SERVICIOS', pool)).toEqual(['Servicios']);
    expect(addCategory(['Servicios'], 'Transporte', pool)).toEqual(['Servicios', 'Transporte']);
    expect(addCategory(['Servicios'], '  ', pool)).toEqual(['Servicios']);
  });

  it('removes one and offers the rest of the pool', () => {
    expect(removeCategory(['A', 'B'], 'A')).toEqual(['B']);
    expect(remainingCategories(pool, ['materiales'])).toEqual(['Arriendo de equipos', 'Servicios']);
  });
});

describe('a vendor from before the rule', () => {
  it('says in words what it lacks', () => {
    expect(
      missingLabels({ incompleteFields: ['legalName', 'categories', 'paymentAccounts'] }),
    ).toEqual(['razón social', 'categorías', 'cuenta de pago']);
    expect(missingLabels({})).toEqual([]);
  });
});

describe('the banks of an account', () => {
  it('has to be one of the list, which is told apart from one that is missing', () => {
    const form = vendorToForm(vendor);
    form.accounts[0] = { ...form.accounts[0]!, bankName: 'Scotia' };
    expect(vendorFormProblems(form)).toEqual([
      'La cuenta 1: el banco tiene que ser uno de la lista.',
    ]);
    form.accounts[0] = { ...form.accounts[0]!, bankName: '' };
    expect(vendorFormProblems(form)).toEqual(['La cuenta 1: falta el banco.']);
  });
});

describe('the categories chosen as a filter', () => {
  const pool = [
    { id: 'k1', name: 'Materiales' },
    { id: 'k2', name: 'Servicios' },
  ];

  it('goes to the URL as ids and comes back from it, without repeats or blanks', () => {
    expect(parseCategoryParam('k1,k2,k1, ,')).toEqual(['k1', 'k2']);
    expect(parseCategoryParam('')).toEqual([]);
    expect(categoryParam(['k1', 'k2'])).toBe('k1,k2');
    expect(categoryParam([])).toBeUndefined();
  });

  it('drops the ones that are no longer in the pool, keeping the order of the URL', () => {
    expect(chosenCategories(['k2', 'gone', 'k1'], pool)).toEqual([
      { id: 'k2', name: 'Servicios' },
      { id: 'k1', name: 'Materiales' },
    ]);
  });

  it('turns the names a picker works with back into ids', () => {
    expect(idsOfNames(['servicios', 'Materiales', 'Nueva'], pool)).toEqual(['k2', 'k1']);
  });
});
