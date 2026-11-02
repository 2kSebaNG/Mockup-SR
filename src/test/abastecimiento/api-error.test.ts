import { apiErrorText, backendMessage } from '@/lib/abastecimiento/api-error';

describe('backendMessage', () => {
  it('reads a string or joins an array message', () => {
    expect(backendMessage({ message: 'boom' })).toBe('boom');
    expect(backendMessage({ message: ['a', 'b'] })).toBe('a; b');
  });

  it('returns null for anything else', () => {
    expect(backendMessage(undefined)).toBeNull();
    expect(backendMessage({})).toBeNull();
  });
});

describe('apiErrorText', () => {
  const text = (message: string) => apiErrorText(new Error(message), 'fallback');

  it('translates purchase order messages', () => {
    expect(text('The issue date cannot be in the future')).toBe(
      'La fecha de emisión no puede ser futura.',
    );
    expect(text('Cannot submit this purchase order — missing required documents: QUOTE')).toBe(
      'Faltan documentos obligatorios (cotización o comprobante).',
    );
    expect(text('Cannot move a purchase order from "SUBMITTED" to "SUBMITTED"')).toBe(
      'Esta OC ya no admite esa acción (estado actual: Enviada).',
    );
  });

  it('translates petty cash messages, formatting the amounts', () => {
    expect(
      text(
        "Expense amount 60000 exceeds this company's configured petty-cash limit of 50000 per transaction",
      ),
    ).toMatch(/\$60\.000.*\$50\.000/);
    expect(text('Cannot close an expense report with no expenses')).toBe(
      'No se puede cerrar una rendición sin gastos.',
    );
    expect(
      text(
        'This person already has an open expense report (Nº 029) — close it before starting another',
      ),
    ).toBe('Esta persona ya tiene una rendición abierta (Nº 029) — ciérrala antes de crear otra.');
    expect(text('Cannot move an expense of an expense report that is not OPEN')).toBe(
      'Solo se puede mover un gasto mientras la rendición está abierta.',
    );
    expect(text('Cannot reassign the responsible of an expense report that is not OPEN')).toBe(
      'Solo se puede reasignar el responsable mientras la rendición está abierta.',
    );
  });

  it('translates deal, project and document messages with their names', () => {
    expect(text('A deal with code "SAC-1" already exists')).toBe(
      'Ya existe un negocio con el código "SAC-1".',
    );
    expect(text('The project end date cannot be earlier than its start date')).toMatch(/término/);
    expect(text('The validity end date cannot be earlier than its start date')).toMatch(
      /vigencia/i,
    );
  });

  it('translates scenario adjustment and budget version messages', () => {
    expect(text('Referenced adjustment "abc" does not exist in this scenario')).toMatch(
      /ajuste referenciado/,
    );
    expect(
      text('Reference "x" must be one of account:<code>, constant:<number>, adjustment:<id>'),
    ).toMatch(/referencia no es válida/);
    expect(text('Duplicate (chartAccountId, period) in lines')).toMatch(/repetida/);
    expect(text('One or more chartAccountId values do not exist')).toMatch(/ya no existe/);
  });

  it('translates session, permission, not-found and validation failures', () => {
    expect(text('Forbidden resource')).toMatch(/permiso/);
    expect(text('Refresh token is invalid, expired, or revoked')).toMatch(/sesión/);
    expect(text('Deal 123 not found')).toMatch(/No se encontró/);
    expect(text('amount must not be less than 0.01')).toMatch(/Revisa los datos/);
  });

  it('falls back for unknown or missing messages', () => {
    expect(text('something else entirely')).toBe('fallback');
    expect(apiErrorText(null, 'fallback')).toBe('fallback');
  });

  it('accepts the raw error body too', () => {
    expect(apiErrorText({ message: ['amount must be a number'] }, 'fallback')).toMatch(
      /Revisa los datos/,
    );
  });
});

describe('apiErrorText — receipts to close a report', () => {
  it('explains that every expense needs a receipt, with how many are missing', () => {
    expect(
      apiErrorText(
        new Error(
          'Every expense needs a receipt before the report can be closed: 2 expense(s) without one',
        ),
        'fallback',
      ),
    ).toBe('Cada gasto necesita al menos un comprobante para cerrar la rendición (faltan 2).');
  });
});

describe('apiErrorText — vendors', () => {
  it('names the tax id already in use', () => {
    expect(
      apiErrorText(new Error('A vendor with tax id "76.123.456-7" already exists'), 'fallback'),
    ).toBe('Ya existe un proveedor con el RUT "76.123.456-7".');
  });
});

describe('apiErrorText — payroll import', () => {
  const text = (message: string) => apiErrorText(new Error(message), 'fallback');

  it('translates the three whole-import blockers, not the generic PDF/JPG/PNG rule', () => {
    expect(text('This company has no payroll chart account configured')).toMatch(
      /Perfil de la Empresa/,
    );
    expect(text('The file is not a valid .xlsx workbook')).toBe(
      'El archivo no es una planilla .xlsx válida.',
    );
    expect(text('file is required and must be a .xlsx file under 5MB')).toMatch(/\.xlsx/);
  });
});

describe('apiErrorText — rate limiting', () => {
  const text = (message: string) => apiErrorText(new Error(message), 'fallback');

  it('explains a 429 from the API throttler instead of showing the generic fallback', () => {
    expect(text('ThrottlerException: Too Many Requests')).toBe(
      'Demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.',
    );
  });
});

describe('apiErrorText — deal client and state', () => {
  it('translates the reasons a deal is turned down', () => {
    expect(
      apiErrorText(
        { message: 'The deal cannot be closed while these projects are still open: P2, P3' },
        'x',
      ),
    ).toBe('Para cerrar el negocio primero hay que cerrar los proyectos P2, P3.');
    expect(
      apiErrorText({ message: 'The deal is closed: reopen it before adding a project to it' }, 'x'),
    ).toBe('El negocio está cerrado: reábrelo para agregar proyectos.');
    expect(apiErrorText({ message: 'That client is deactivated' }, 'x')).toBe(
      'Ese cliente está desactivado.',
    );
    expect(apiErrorText({ message: "That client is not one of this company's" }, 'x')).toBe(
      'Ese cliente no pertenece a la empresa.',
    );
  });
});

describe('apiErrorText — contratos and the unit of a project', () => {
  it('translates what is turned down when editing them', () => {
    expect(apiErrorText({ message: 'A contrato with code "SAC1-C02" already exists' }, 'x')).toBe(
      'Ya existe un contrato con el código "SAC1-C02".',
    );
    expect(
      apiErrorText({ message: 'The contrato end date cannot be earlier than its start date' }, 'x'),
    ).toBe('El término del contrato no puede ser anterior a su inicio.');
    expect(apiErrorText({ message: 'That business unit is deactivated' }, 'x')).toBe(
      'Esa unidad de negocio está desactivada.',
    );
    expect(apiErrorText({ message: "That business unit is not one of this company's" }, 'x')).toBe(
      'Esa unidad de negocio no pertenece a la empresa.',
    );
  });
});

describe('apiErrorText — booking a sale', () => {
  it('translates why an account cannot take it', () => {
    expect(
      apiErrorText(
        {
          message: 'Sales can only be booked to income accounts: mark the account as income first',
        },
        'x',
      ),
    ).toBe(
      'Las ventas solo se pueden registrar en cuentas de ingreso: marca la cuenta como ingreso en Cuentas Contables.',
    );
    expect(apiErrorText({ message: 'That account is deactivated' }, 'x')).toBe(
      'Esa cuenta contable está desactivada.',
    );
    expect(
      apiErrorText({ message: "That account is not one of the project's company's" }, 'x'),
    ).toBe('Esa cuenta no es de la empresa del proyecto.');
  });
});
