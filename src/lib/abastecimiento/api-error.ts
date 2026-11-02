import { STATUS_LABEL_ES } from './purchase-order';

/** Nest's error body is `{ message: string | string[], ... }` — openapi-fetch hands it
 * back untyped since the spec only documents the status code. */
export function backendMessage(error: unknown): string | null {
  const message = (error as { message?: unknown } | null | undefined)?.message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : null;
}

type Rule = [RegExp, string | ((match: RegExpMatchArray) => string)];

/**
 * What the backend says (English — API messages are for developers) and what the
 * person using the app should read. Ordered: the first match wins, so specific rules
 * sit above the broad catch-alls at the bottom. Anything unmatched falls back to the
 * caller's own generic text.
 */
const RULES: Rule[] = [
  // Purchase orders
  [/issue date cannot be in the future/i, 'La fecha de emisión no puede ser futura.'],
  [
    /issue date cannot be more than a year/i,
    'La fecha de emisión no puede ser de hace más de un año.',
  ],
  [
    /payment date cannot be earlier/i,
    'La fecha de pago estimada no puede ser anterior a la fecha de emisión.',
  ],
  [/missing required fields/i, 'Faltan campos obligatorios para enviar la orden de compra.'],
  [/missing required documents/i, 'Faltan documentos obligatorios (cotización o comprobante).'],
  [/only a draft purchase order can be edited/i, 'Solo se puede editar una OC en borrador.'],
  [/only a rejected purchase order can be revised/i, 'Solo se puede revisar una OC rechazada.'],
  [
    /cannot move a purchase order from "(\w+)" to "(\w+)"/i,
    (m) => `Esta OC ya no admite esa acción (estado actual: ${STATUS_LABEL_ES[m[1]!] ?? m[1]}).`,
  ],
  [/transfer receipt/i, 'Falta el comprobante de transferencia.'],

  // Petty cash
  [
    /expense amount ([\d.]+) exceeds .* limit of ([\d.]+)/i,
    (m) => `El monto ${clp(m[1]!)} supera el tope de caja chica de ${clp(m[2]!)} por gasto.`,
  ],
  [/expense date cannot be in the future/i, 'La fecha del gasto no puede ser futura.'],
  [
    /add an expense to an expense report that is not open/i,
    'Solo se pueden agregar gastos a una rendición abierta.',
  ],
  [
    /move an expense of an expense report that is not open/i,
    'Solo se puede mover un gasto mientras la rendición está abierta.',
  ],
  [
    /reassign the responsible of an expense report that is not open/i,
    'Solo se puede reasignar el responsable mientras la rendición está abierta.',
  ],
  [/report with no expenses/i, 'No se puede cerrar una rendición sin gastos.'],
  [
    /this person already has an open expense report \(Nº (\d+)\)/i,
    (m) =>
      `Esta persona ya tiene una rendición abierta (Nº ${m[1]}) — ciérrala antes de crear otra.`,
  ],
  [
    /every expense needs a receipt.*?(\d+) expense/i,
    (m) => `Cada gasto necesita al menos un comprobante para cerrar la rendición (faltan ${m[1]}).`,
  ],
  [/expense report is already closed/i, 'Esta rendición ya está cerrada.'],

  // Vendors
  [
    /a vendor with tax id "(.+)" already exists/i,
    (m) => `Ya existe un proveedor con el RUT "${m[1]}".`,
  ],

  // Deals, projects, contractual documents
  [/award date cannot be in the future/i, 'La fecha de adjudicación no puede ser futura.'],
  [
    /project end date cannot be earlier/i,
    'La fecha de término del proyecto no puede ser anterior a su inicio.',
  ],
  [
    /validity end date cannot be earlier/i,
    'La vigencia hasta no puede ser anterior a la vigencia desde.',
  ],
  [
    /a deal with code "(.+)" already exists/i,
    (m) => `Ya existe un negocio con el código "${m[1]}".`,
  ],
  [
    /deal cannot be closed while these projects are still open: (.+)/i,
    (m) => `Para cerrar el negocio primero hay que cerrar los proyectos ${m[1]}.`,
  ],
  [
    /deal is closed: reopen it before adding a project/i,
    'El negocio está cerrado: reábrelo para agregar proyectos.',
  ],
  [
    /a contrato with code "(.+)" already exists/i,
    (m) => `Ya existe un contrato con el código "${m[1]}".`,
  ],
  [
    /contrato end date cannot be earlier/i,
    'El término del contrato no puede ser anterior a su inicio.',
  ],
  [/that business unit is deactivated/i, 'Esa unidad de negocio está desactivada.'],
  [
    /that business unit is not one of this company/i,
    'Esa unidad de negocio no pertenece a la empresa.',
  ],
  [
    /sales can only be booked to income accounts/i,
    'Las ventas solo se pueden registrar en cuentas de ingreso: marca la cuenta como ingreso en Cuentas Contables.',
  ],
  [/that account is deactivated/i, 'Esa cuenta contable está desactivada.'],
  [
    /that account is not one of the project's company/i,
    'Esa cuenta no es de la empresa del proyecto.',
  ],
  [/that client is deactivated/i, 'Ese cliente está desactivado.'],
  [/that client is not one of this company/i, 'Ese cliente no pertenece a la empresa.'],
  [
    /an account with code "(.+)" already exists/i,
    (m) => `Ya existe una cuenta contable con el código "${m[1]}".`,
  ],
  [/a role named "(.+)" already exists/i, (m) => `Ya existe un rol llamado "${m[1]}".`],
  // Administración (answered by the local store until the API is connected; docs/plan-abastecimiento.md)
  [/a business unit with that name already exists/i, 'Ya existe una unidad de negocio con ese nombre.'],
  [/an account cannot be moved inside itself/i, 'Una cuenta no puede quedar dentro de sí misma ni de sus subcuentas.'],
  [/the parent account does not exist/i, 'La cuenta madre ya no existe. Recarga la página.'],
  [/a rate of that tax already starts on that day/i, 'Ese impuesto ya tiene una tasa que rige desde ese día.'],
  [/a rate cannot start before the first rate/i, 'Una tasa no puede regir antes que la primera de su impuesto.'],
  [/the first rate of a tax keeps its date/i, 'La primera tasa mantiene su fecha: cubre los días anteriores.'],
  [/the first rate of a tax cannot be removed/i, 'La primera tasa de un impuesto no se puede quitar.'],
  [/percent must be between 0 and 100/i, 'El porcentaje tiene que estar entre 0 y 100, con hasta dos decimales.'],
  [/taxId must be a valid RUT/i, 'El RUT no es válido. Revisa el dígito verificador.'],
  [/a client with that tax ID already exists/i, 'Ya existe un cliente con ese RUT.'],
  [/that sigla is already used by another client/i, 'Esa sigla ya la usa otro cliente.'],
  [/sigla must be 2 to 10 letters or digits/i, 'La sigla tiene que tener de 2 a 10 letras o números.'],
  [/a vendor with that tax ID already exists/i, 'Ya existe un proveedor con ese RUT.'],
  [/a vendor needs at least one contact/i, 'El proveedor necesita al menos un contacto.'],
  [/a vendor needs at least one payment account/i, 'El proveedor necesita al menos una cuenta de pago.'],
  [/a category named "(.+)" already exists/i, (m) => `Ya existe una categoría llamada "${m[1]}".`],
  [/that category is still used by (\d+) vendors?/i, (m) => `La usan ${m[1]} ${m[1] === '1' ? 'proveedor' : 'proveedores'}: quítala de ellos primero.`],

  // Scenarios and budget versions
  [
    /conditional operation needs comparator/i,
    'Una operación condicional necesita un comparador y las dos referencias.',
  ],
  [/unsupported operation/i, 'Esa operación no está disponible.'],
  [
    /referenced adjustment .* does not exist/i,
    'El ajuste referenciado no existe en este escenario.',
  ],
  [
    /invalid constant reference|unknown reference kind|reference ".*" must be one of/i,
    'La referencia no es válida: usa una cuenta, un número o un ajuste.',
  ],
  [
    /chartAccountId values do not exist/i,
    'Alguna de las cuentas contables de las líneas ya no existe.',
  ],
  [/duplicate \(chartAccountId, period\)/i, 'Hay una cuenta repetida en el mismo mes.'],

  // Payroll import (checked before the generic "file is required" rule below)
  [
    /no payroll chart account configured/i,
    'La empresa no tiene una cuenta contable de remuneraciones configurada — defínela en Perfil de la Empresa.',
  ],
  [/file is not a valid \.xlsx workbook/i, 'El archivo no es una planilla .xlsx válida.'],
  [
    /file is required and must be a \.xlsx file/i,
    'El archivo debe ser una planilla .xlsx de hasta 5MB.',
  ],

  // Files
  [/file is required/i, 'El archivo debe ser PDF, JPG o PNG de hasta 10MB.'],

  // Rate limiting (the API's throttler answers 429 "ThrottlerException: Too Many Requests")
  [
    /too many requests|throttler/i,
    'Demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.',
  ],

  // Session and permissions
  [/not yet associated with a company/i, 'Tu usuario todavía no está asociado a una empresa.'],
  [
    /assertion|refresh token|invalid or expired|unauthorized/i,
    'Tu sesión expiró. Vuelve a iniciar sesión.',
  ],
  [/forbidden|permission/i, 'No tienes permiso para realizar esta acción.'],

  // Catch-alls
  [/not found/i, 'No se encontró el registro; puede que ya no exista.'],
  [
    /must be|must not|must contain|should not be empty|must be longer|must be shorter/i,
    'Revisa los datos ingresados: hay campos con un valor no válido.',
  ],
];

function clp(raw: string): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(raw));
}

/** Spanish text for an API failure, or `fallback` when the backend's message isn't one
 * we know how to translate. Accepts a thrown `Error` (the mutation hooks keep the
 * backend's message in it) or the raw error body. */
export function apiErrorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : backendMessage(error);
  if (!message) return fallback;
  for (const [pattern, text] of RULES) {
    const match = message.match(pattern);
    if (match) return typeof text === 'function' ? text(match) : text;
  }
  return fallback;
}
