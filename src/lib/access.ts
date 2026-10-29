// People and access, as the Human360 API defines them (module Authentication, branch employee-invitation): the
// permission catalog, roles, employees with their invitations, and the session. Browser-safe and pure: every operation
// takes the state and returns the next one with an outcome shaped like the API's (`GenericResponse` message or
// `ErrorDetail` with status and code), so the screens can switch to the real endpoints without changing their logic.

export const permissionCatalog = [
  { key: "roles", name: "Roles", permissions: [
    { code: "roles.read", name: "Ver roles", description: "Consultar los roles y el catálogo de permisos." },
    { code: "roles.manage", name: "Gestionar roles", description: "Crear, editar y eliminar roles." },
  ] },
  { key: "employees", name: "Empleados", permissions: [
    { code: "employees.read", name: "Ver empleados", description: "Consultar el listado y el detalle de los empleados." },
    { code: "employees.invite", name: "Invitar empleados", description: "Dar de alta empleados y gestionar sus invitaciones." },
    { code: "employees.manage", name: "Editar empleados", description: "Editar los datos y los roles de los empleados." },
    { code: "employees.deactivate", name: "Desactivar empleados", description: "Desactivar y reactivar el acceso de los empleados." },
    { code: "employees.delete", name: "Eliminar empleados", description: "Eliminar empleados de forma definitiva." },
  ] },
  { key: "notifications", name: "Notificaciones", permissions: [
    { code: "notifications.test", name: "Enviar correo de prueba", description: "Enviar un correo de prueba para verificar la integración." },
  ] },
  { key: "system", name: "Sistema", permissions: [
    { code: "system.jobs", name: "Panel de trabajos", description: "Ver el panel de trabajos en segundo plano (Hangfire)." },
  ] },
] as const;

export type PermissionCode = (typeof permissionCatalog)[number]["permissions"][number]["code"];
export type PermissionDefinition = { code: PermissionCode; name: string; description: string };
export const permissionDefinitions: PermissionDefinition[] = permissionCatalog.flatMap((group): readonly PermissionDefinition[] => group.permissions);
export const allPermissions: PermissionCode[] = permissionDefinitions.map(permission => permission.code);
export const permissionName = (code: PermissionCode) => permissionDefinitions.find(permission => permission.code === code)?.name ?? code;

export type Role = { id: string; name: string; description: string | null; isSystem: boolean; permissions: PermissionCode[]; createdAt: string };

export type EmployeeStatus = "pending" | "expired" | "active" | "deactivated";
export type EmailStatus = "notSent" | "queued" | "sent" | "delivered" | "bounced" | "failed" | "complained" | "suppressed";
export type SignInMethod = "password" | "microsoft";

export type Invitation = { token: string; expiresAt: string; sends: string[]; email: { status: EmailStatus; updatedAt: string } };
export type Employee = {
  id: string; email: string; firstName: string; lastName: string; rut: string; roleIds: string[];
  password: string | null; signInMethods: SignInMethod[];
  createdAt: string; createdBy: string | null; activatedAt: string | null;
  deactivation: { at: string; by: string | null; reason: string | null } | null;
  /** Null once accepted. */
  invitation: Invitation | null;
  failedLogins: number; lockedUntil: string | null;
};

export type AccessState = { roles: Role[]; employees: Employee[]; sessionId: string | null; acceptedTokens: string[]; termsVersion: string; privacyVersion: string };

export type AccessError = { status: number; code?: string; message: string; details?: Record<string, string> };
export type Outcome<T> = { ok: true; data: T; message: string } | { ok: false; error: AccessError };
export type Step<T> = { state: AccessState; outcome: Outcome<T> };

const ok = <T>(state: AccessState, data: T, message: string): Step<T> => ({ state, outcome: { ok: true, data, message } });
const fail = <T>(state: AccessState, status: number, message: string, code?: string, details?: Record<string, string>): Step<T> =>
  ({ state, outcome: { ok: false, error: { status, message, ...(code && { code }), ...(details && { details }) } } });
const invalid = <T>(state: AccessState, details: Record<string, string>): Step<T> => fail(state, 400, "Revisa los datos del formulario.", undefined, details);

export const INVITATION_HOURS = 72;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_SENDS_PER_DAY = 10;
const HOUR = 3_600_000;
export const PAGE_SIZES = [5, 10, 25] as const;

// --- Text rules shared with the forms ---------------------------------------------------------------------------

const collapse = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ");
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function rutDv(body: number) {
  let sum = 0;
  let factor = 2;
  for (const digit of String(body).split("").reverse()) {
    sum += Number(digit) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const dv = 11 - (sum % 11);
  return dv === 11 ? "0" : dv === 10 ? "K" : String(dv);
}

/** "12.345.678-5", "12345678-5" or "123456785" (DV k or K) ⇒ "12345678-5"; null when the format or the check digit is wrong. */
export function normalizeRut(input: string): string | null {
  const value = input.trim().toUpperCase();
  const match = /^(\d{1,2}(?:\.\d{3}){2}|\d{7,8})-?([\dK])$/.exec(value);
  if (!match) return null;
  const body = Number(match[1]!.replace(/\./g, ""));
  if (!body || rutDv(body) !== match[2]) return null;
  return `${body}-${match[2]}`;
}
/** "12345678-5" ⇒ "12.345.678-5". */
export const formatRut = (rut: string) => {
  const [body = "", dv = ""] = rut.split("-");
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
};

const nameError = (value: string, label: string) => {
  const name = collapse(value);
  if (!name) return `${label} es obligatorio.`;
  if (name.length > 50) return `${label} admite hasta 50 caracteres.`;
  if (!/^[\p{L} .'’-]+$/u.test(name)) return `${label} solo admite letras, espacios y los signos - ' .`;
  return null;
};
const emailError = (value: string) => {
  const email = value.trim();
  if (!email) return "El correo es obligatorio.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El correo no es válido.";
  return null;
};

export const passwordRules = [
  { key: "length", label: "Entre 8 y 128 caracteres", test: (value: string) => value.length >= 8 && value.length <= 128 },
  { key: "upper", label: "Una mayúscula", test: (value: string) => /\p{Lu}/u.test(value) },
  { key: "lower", label: "Una minúscula", test: (value: string) => /\p{Ll}/u.test(value) },
  { key: "digit", label: "Un número", test: (value: string) => /\d/.test(value) },
  { key: "symbol", label: "Un símbolo", test: (value: string) => /[^\p{L}\d\s]/u.test(value) },
] as const;

/** The backend also refuses passwords that contain the person's name, the local part of their email or their RUT. */
function personalDataIn(password: string, employee: Employee) {
  const haystack = fold(password);
  const pieces = [...`${employee.firstName} ${employee.lastName}`.split(/\s+/), employee.email.split("@")[0] ?? "", employee.rut.split("-")[0] ?? ""];
  return pieces.some(piece => piece.length >= 3 && haystack.includes(fold(piece)));
}

// --- Reading ----------------------------------------------------------------------------------------------------

export const fullName = (employee: Employee) => `${employee.firstName} ${employee.lastName}`;
export const findEmployee = (state: AccessState, id: string) => state.employees.find(employee => employee.id === id);
export const findRole = (state: AccessState, id: string) => state.roles.find(role => role.id === id);
export const sessionEmployee = (state: AccessState) => (state.sessionId ? findEmployee(state, state.sessionId) ?? null : null);

export function employeeStatus(employee: Employee, now = Date.now()): EmployeeStatus {
  if (employee.invitation) return Date.parse(employee.invitation.expiresAt) <= now ? "expired" : "pending";
  return employee.deactivation ? "deactivated" : "active";
}
export const statusLabels: Record<EmployeeStatus, string> = { pending: "Invitación pendiente", expired: "Invitación vencida", active: "Activo", deactivated: "Desactivado" };
export const emailStatusLabels: Record<EmailStatus, string> = {
  notSent: "No enviado", queued: "En cola", sent: "Enviado", delivered: "Entregado", bounced: "Rebotado", failed: "Falló", complained: "Marcado como spam", suppressed: "Suprimido",
};
/** The mockup has no mail provider: a queued email counts as delivered a few seconds later, as the webhook would report. */
export const emailStatusOf = (invitation: Invitation, now = Date.now()): EmailStatus =>
  invitation.email.status === "queued" && Date.parse(invitation.email.updatedAt) < now - 5000 ? "delivered" : invitation.email.status;
export const deliverable = (status: EmailStatus) => !["bounced", "complained", "suppressed", "failed"].includes(status);

const isAdmin = (state: AccessState, employee: Employee) => employee.roleIds.some(id => findRole(state, id)?.isSystem);
/** The union of the employee's roles' permissions, in catalog order; Admin has them all. */
export function permissionsOf(state: AccessState, employee: Employee | null): PermissionCode[] {
  if (!employee) return [];
  const granted = new Set(employee.roleIds.flatMap(id => findRole(state, id)?.permissions ?? []));
  return allPermissions.filter(code => granted.has(code));
}
export const can = (state: AccessState, code: PermissionCode) => permissionsOf(state, sessionEmployee(state)).includes(code);

/** Employees that count for a role: everyone with it except the deleted (pending invitations included, as ROLE_IN_USE). */
export const roleMembers = (state: AccessState, roleId: string) => state.employees.filter(employee => employee.roleIds.includes(roleId));
export const roleUserCount = (state: AccessState, roleId: string) => roleMembers(state, roleId).filter(employee => !employee.invitation).length;

/** Write scope: the target's permissions are a subset of the actor's, and only an Admin acts on an Admin. */
export function withinScope(state: AccessState, actor: Employee, target: Employee) {
  if (isAdmin(state, actor)) return true;
  if (isAdmin(state, target)) return false;
  const mine = new Set(permissionsOf(state, actor));
  return permissionsOf(state, target).every(code => mine.has(code));
}
/** Roles the actor may give or take away: those whose permissions they hold. */
export function assignableRoles(state: AccessState, actor: Employee | null) {
  if (!actor) return [];
  const mine = new Set(permissionsOf(state, actor));
  return state.roles.filter(role => role.permissions.every(code => mine.has(code))).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** When the invitation can be sent again (cooldown and the daily limit), or null if it can now. */
export function canResendAt(employee: Employee, now = Date.now()): string | null {
  const invitation = employee.invitation;
  if (!invitation) return null;
  const sends = invitation.sends.map(Date.parse).sort((a, b) => a - b);
  const last = sends.at(-1);
  const recent = sends.filter(time => time > now - 24 * HOUR);
  const waits: number[] = [];
  if (invitation.email.status !== "notSent" && last !== undefined && last + RESEND_COOLDOWN_SECONDS * 1000 > now) waits.push(last + RESEND_COOLDOWN_SECONDS * 1000);
  if (recent.length >= MAX_SENDS_PER_DAY) waits.push(recent[recent.length - MAX_SENDS_PER_DAY]! + 24 * HOUR);
  return waits.length ? new Date(Math.max(...waits)).toISOString() : null;
}

export type EmployeeQuery = { search?: string | undefined; status?: EmployeeStatus | "" | undefined; roleId?: string | undefined; sort?: "name" | "email" | "createdAt" | "status" | undefined; direction?: "asc" | "desc" | undefined; page?: number | undefined; pageSize?: number | undefined };
const statusOrder: EmployeeStatus[] = ["pending", "expired", "active", "deactivated"];

/** GET /employees: search in names, email and RUT (no case, no accents, RUT with or without dots), filters, sort and page. */
export function listEmployees(state: AccessState, query: EmployeeQuery, now = Date.now()) {
  const term = fold(query.search?.trim() ?? "");
  const rutTerm = term.replace(/[.-]/g, "");
  const sortKey = (employee: Employee) => fold(`${employee.lastName} ${employee.firstName} ${employee.email} ${employee.rut}`);
  const items = state.employees
    .filter(employee => !term || fold(`${employee.firstName} ${employee.lastName} ${employee.email}`).includes(term) || (rutTerm && employee.rut.replace("-", "").toLowerCase().includes(rutTerm)))
    .filter(employee => !query.status || employeeStatus(employee, now) === query.status)
    .filter(employee => !query.roleId || employee.roleIds.includes(query.roleId))
    .sort((a, b) => {
      const sort = query.sort ?? "name";
      const order = sort === "email" ? a.email.localeCompare(b.email) : sort === "createdAt" ? a.createdAt.localeCompare(b.createdAt)
        : sort === "status" ? statusOrder.indexOf(employeeStatus(a, now)) - statusOrder.indexOf(employeeStatus(b, now)) : 0;
      return (order || sortKey(a).localeCompare(sortKey(b), "es")) * (query.direction === "desc" ? -1 : 1);
    });
  const pageSize = PAGE_SIZES.includes(query.pageSize as 5) ? query.pageSize! : 10;
  const page = Math.max(1, query.page ?? 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: items.length };
}

export function listRoles(state: AccessState, search = "") {
  const term = fold(search.trim());
  return state.roles.filter(role => !term || fold(role.name).includes(term)).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// --- Session ----------------------------------------------------------------------------------------------------

const update = (state: AccessState, id: string, change: (employee: Employee) => Employee): AccessState =>
  ({ ...state, employees: state.employees.map(employee => (employee.id === id ? change(employee) : employee)) });

/** POST /auth/login. */
export function login(state: AccessState, input: { email: string; password: string }, now = Date.now()): Step<Employee> {
  const details: Record<string, string> = {};
  if (!input.email.trim()) details["email"] = "El correo es obligatorio.";
  if (!input.password) details["password"] = "La contraseña es obligatoria.";
  if (Object.keys(details).length) return invalid(state, details);
  const employee = state.employees.find(candidate => candidate.email.toLowerCase() === input.email.trim().toLowerCase());
  // Pending invitations and wrong passwords look the same from outside.
  if (!employee || employee.invitation || !employee.password) return fail(state, 401, "Correo o contraseña incorrectos.", "INVALID_CREDENTIALS");
  if (employee.lockedUntil && Date.parse(employee.lockedUntil) > now) return fail(state, 403, "La cuenta está bloqueada temporalmente por intentos fallidos.", "ACCOUNT_LOCKED");
  if (employee.password !== input.password) {
    const failed = employee.failedLogins + 1;
    const next = update(state, employee.id, current => ({ ...current, failedLogins: failed >= 5 ? 0 : failed, lockedUntil: failed >= 5 ? new Date(now + 15 * 60_000).toISOString() : null }));
    return fail(next, 401, "Correo o contraseña incorrectos.", "INVALID_CREDENTIALS");
  }
  if (employee.deactivation) return fail(state, 403, "La cuenta está desactivada. Contacta a un administrador.", "ACCOUNT_DEACTIVATED");
  const next = { ...update(state, employee.id, current => ({ ...current, failedLogins: 0, lockedUntil: null })), sessionId: employee.id };
  return ok(next, employee, "Sesión iniciada.");
}

/** GET /auth/microsoft/login: in the mockup the chosen Microsoft account arrives here; errors go back to the login as ?error=. */
export function microsoftLogin(state: AccessState, email: string): Step<Employee> {
  const employee = state.employees.find(candidate => candidate.email.toLowerCase() === email.toLowerCase());
  if (!employee) return fail(state, 302, "", "MICROSOFT_ACCOUNT_NOT_LINKED");
  if (employee.invitation) return fail(state, 302, "", "INVITATION_PENDING");
  if (employee.deactivation) return fail(state, 302, "", "ACCOUNT_DEACTIVATED");
  const linked = employee.signInMethods.includes("microsoft") ? state : update(state, employee.id, current => ({ ...current, signInMethods: [...current.signInMethods, "microsoft"] }));
  return ok({ ...linked, sessionId: employee.id }, employee, "Sesión iniciada.");
}

/** POST /auth/logout: always 204. */
export const logout = (state: AccessState): Step<null> => ok({ ...state, sessionId: null }, null, "");

/** Password recovery is the next backend feature (password-reset); the answer never says whether the email exists. */
export function requestPasswordReset(state: AccessState, email: string): Step<null> {
  const error = emailError(email);
  if (error) return invalid(state, { email: error });
  return ok(state, null, "Si el correo corresponde a una cuenta, te enviaremos un enlace para crear una contraseña nueva.");
}

// --- Roles ------------------------------------------------------------------------------------------------------

export type RoleInput = { name: string; description: string; permissions: PermissionCode[] };

function roleDetails(input: RoleInput) {
  const details: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 2 || name.length > 50) details["name"] = "El nombre debe tener entre 2 y 50 caracteres.";
  if (input.description.trim().length > 250) details["description"] = "La descripción admite hasta 250 caracteres.";
  if (!input.permissions.length) details["permissions"] = "Elige al menos un permiso.";
  return details;
}
const nameTaken = (state: AccessState, name: string, except?: string) => state.roles.some(role => role.id !== except && fold(role.name) === fold(name.trim()));
/** A non-Admin actor only grants or removes permissions they hold. */
const outOfReach = (state: AccessState, actor: Employee, changed: PermissionCode[]) => {
  if (isAdmin(state, actor)) return false;
  const mine = new Set(permissionsOf(state, actor));
  return changed.some(code => !mine.has(code));
};
const cleanRole = (input: RoleInput) => ({
  name: collapse(input.name),
  description: input.description.trim().replace(/\r\n/g, "\n") || null,
  permissions: allPermissions.filter(code => input.permissions.includes(code)),
});

export function createRole(state: AccessState, actor: Employee, input: RoleInput, now = Date.now()): Step<Role> {
  const details = roleDetails(input);
  if (Object.keys(details).length) return invalid(state, details);
  const clean = cleanRole(input);
  if (outOfReach(state, actor, clean.permissions)) return fail(state, 403, "No puedes otorgar o quitar permisos que no tienes.", "ROLE_ASSIGNMENT_FORBIDDEN");
  if (nameTaken(state, clean.name)) return fail(state, 409, "Ya existe un rol con ese nombre.", "ROLE_NAME_TAKEN");
  const role: Role = { id: newId(), isSystem: false, createdAt: new Date(now).toISOString(), ...clean };
  return ok({ ...state, roles: [...state.roles, role] }, role, "Rol creado.");
}

export function updateRole(state: AccessState, actor: Employee, id: string, input: RoleInput): Step<Role> {
  const details = roleDetails(input);
  if (Object.keys(details).length) return invalid(state, details);
  const role = findRole(state, id);
  if (!role) return fail(state, 404, "El rol no existe.", "ROLE_NOT_FOUND");
  if (role.isSystem) return fail(state, 409, "El rol Administrador es del sistema y no se puede modificar.", "SYSTEM_ROLE_READONLY");
  const clean = cleanRole(input);
  const changed = [...clean.permissions.filter(code => !role.permissions.includes(code)), ...role.permissions.filter(code => !clean.permissions.includes(code))];
  if (outOfReach(state, actor, changed)) return fail(state, 403, "No puedes otorgar o quitar permisos que no tienes.", "ROLE_ASSIGNMENT_FORBIDDEN");
  if (nameTaken(state, clean.name, id)) return fail(state, 409, "Ya existe un rol con ese nombre.", "ROLE_NAME_TAKEN");
  const next = { ...role, ...clean };
  return ok({ ...state, roles: state.roles.map(current => (current.id === id ? next : current)) }, next, "Rol actualizado.");
}

export function deleteRole(state: AccessState, id: string): Step<null> {
  const role = findRole(state, id);
  if (!role) return fail(state, 404, "El rol no existe.", "ROLE_NOT_FOUND");
  if (role.isSystem) return fail(state, 409, "El rol Administrador es del sistema y no se puede eliminar.", "SYSTEM_ROLE_READONLY");
  if (roleMembers(state, id).length) return fail(state, 409, "El rol tiene empleados asignados. Quítaselo antes de eliminarlo.", "ROLE_IN_USE");
  return ok({ ...state, roles: state.roles.filter(current => current.id !== id) }, null, "Rol eliminado.");
}

// --- Employees ----------------------------------------------------------------------------------------------------

export type EmployeeInput = { email: string; firstName: string; lastName: string; rut: string; roleIds: string[] };
export type EmployeeUpdate = Omit<EmployeeInput, "email">;

function employeeDetails(state: AccessState, input: EmployeeUpdate & { email?: string }) {
  const details: Record<string, string> = {};
  if (input.email !== undefined) { const error = emailError(input.email); if (error) details["email"] = error; }
  const first = nameError(input.firstName, "El nombre"); if (first) details["firstName"] = first;
  const last = nameError(input.lastName, "El apellido"); if (last) details["lastName"] = last;
  if (!normalizeRut(input.rut)) details["rut"] = "El RUT no es válido. Revisa el dígito verificador.";
  if (input.roleIds.length < 1 || input.roleIds.length > 10) details["roleIds"] = "Asigna entre 1 y 10 roles.";
  else if (input.roleIds.some(id => !findRole(state, id))) details["roleIds"] = "Uno de los roles no existe.";
  return details;
}
const rolesOutOfReach = (state: AccessState, actor: Employee, roleIds: string[]) => {
  const reachable = new Set(assignableRoles(state, actor).map(role => role.id));
  return roleIds.some(id => !reachable.has(id));
};
const emailTaken = (state: AccessState, email: string, except?: string) => state.employees.some(employee => employee.id !== except && employee.email.toLowerCase() === email.trim().toLowerCase());
const rutTaken = (state: AccessState, rut: string, except?: string) => state.employees.some(employee => employee.id !== except && employee.rut === rut);
const activeAdmins = (state: AccessState) => state.employees.filter(employee => !employee.invitation && !employee.deactivation && isAdmin(state, employee));

function newInvitation(now: number): Invitation {
  const at = new Date(now).toISOString();
  return { token: newToken(), expiresAt: new Date(now + INVITATION_HOURS * HOUR).toISOString(), sends: [at], email: { status: "queued", updatedAt: at } };
}

/** POST /employees: registers the employee and sends the invitation (link valid 72 h). */
export function createEmployee(state: AccessState, actor: Employee, input: EmployeeInput, now = Date.now()): Step<Employee> {
  const details = employeeDetails(state, input);
  if (Object.keys(details).length) return invalid(state, details);
  if (rolesOutOfReach(state, actor, input.roleIds)) return fail(state, 403, "No puedes asignar o quitar roles con permisos que no tienes.", "ROLE_ASSIGNMENT_FORBIDDEN");
  if (emailTaken(state, input.email)) return fail(state, 409, "Ya existe un usuario con ese correo.", "EMAIL_TAKEN");
  const rut = normalizeRut(input.rut)!;
  if (rutTaken(state, rut)) return fail(state, 409, "Ya existe un usuario con ese RUT.", "RUT_TAKEN");
  const employee: Employee = {
    id: newId(), email: input.email.trim().toLowerCase(), firstName: collapse(input.firstName), lastName: collapse(input.lastName), rut, roleIds: [...new Set(input.roleIds)],
    password: null, signInMethods: [], createdAt: new Date(now).toISOString(), createdBy: actor.id, activatedAt: null, deactivation: null,
    invitation: newInvitation(now), failedLogins: 0, lockedUntil: null,
  };
  return ok({ ...state, employees: [...state.employees, employee] }, employee, "Empleado invitado.");
}

/** The checks every write on an employee runs first: exists ⇒ not yourself ⇒ within scope. */
function guard(state: AccessState, actor: Employee, id: string): AccessError | Employee {
  const target = findEmployee(state, id);
  if (!target) return { status: 404, code: "EMPLOYEE_NOT_FOUND", message: "El empleado no existe." };
  if (target.id === actor.id) return { status: 409, code: "CANNOT_MODIFY_SELF", message: "No puedes realizar esta acción sobre tu propia cuenta." };
  if (!withinScope(state, actor, target)) return { status: 403, code: "EMPLOYEE_OUT_OF_SCOPE", message: "No puedes gestionar a un empleado con más permisos que tú." };
  return target;
}
const isError = (value: AccessError | Employee): value is AccessError => "status" in value;
const refuse = <T>(state: AccessState, error: AccessError): Step<T> => ({ state, outcome: { ok: false, error } });

export function updateEmployee(state: AccessState, actor: Employee, id: string, input: EmployeeUpdate): Step<Employee> {
  const details = employeeDetails(state, input);
  if (Object.keys(details).length) return invalid(state, details);
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  const changed = [...input.roleIds.filter(role => !target.roleIds.includes(role)), ...target.roleIds.filter(role => !input.roleIds.includes(role))];
  if (rolesOutOfReach(state, actor, changed)) return fail(state, 403, "No puedes asignar o quitar roles con permisos que no tienes.", "ROLE_ASSIGNMENT_FORBIDDEN");
  const rut = normalizeRut(input.rut)!;
  if (rutTaken(state, rut, id)) return fail(state, 409, "Ya existe un usuario con ese RUT.", "RUT_TAKEN");
  const next: Employee = { ...target, firstName: collapse(input.firstName), lastName: collapse(input.lastName), rut, roleIds: [...new Set(input.roleIds)] };
  const after = update(state, id, () => next);
  if (isAdmin(state, target) && !isAdmin(after, next) && activeAdmins(after).length === 0) return fail(state, 409, "Debe quedar al menos un administrador activo.", "LAST_ADMIN");
  return ok(after, next, "Empleado actualizado.");
}

function sendWindow(state: AccessState, target: Employee, now: number): AccessError | null {
  const at = canResendAt(target, now);
  if (!at) return null;
  const retryAfter = Math.ceil((Date.parse(at) - now) / 1000);
  const limited = target.invitation!.sends.filter(time => Date.parse(time) > now - 24 * HOUR).length >= MAX_SENDS_PER_DAY;
  return limited
    ? { status: 429, code: "INVITATION_SEND_LIMIT", message: "Se alcanzó el máximo de envíos de invitación por hoy para este empleado.", details: { retryAfter: String(retryAfter) } }
    : { status: 429, code: "INVITATION_COOLDOWN", message: "Espera un momento antes de volver a enviar la invitación.", details: { retryAfter: String(retryAfter) } };
}
const reissue = (invitation: Invitation, now: number): Invitation => {
  const fresh = newInvitation(now);
  // A send that never left the queue does not count for the limit.
  const counted = invitation.email.status === "notSent" ? invitation.sends.slice(0, -1) : invitation.sends;
  return { ...fresh, sends: [...counted, ...fresh.sends] };
};

/** POST /employees/{id}/invitation/resend: a new 72 h link; the previous one stops working. */
export function resendInvitation(state: AccessState, actor: Employee, id: string, now = Date.now()): Step<Employee> {
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  if (!target.invitation) return fail(state, 409, "La invitación ya fue aceptada. Inicia sesión.", "INVITATION_ALREADY_ACCEPTED");
  if (!deliverable(target.invitation.email.status)) return fail(state, 409, "El correo no se puede entregar a esa dirección. Cambia el correo para reenviar.", "EMAIL_UNDELIVERABLE");
  const wait = sendWindow(state, target, now);
  if (wait) return refuse(state, wait);
  const next = { ...target, invitation: reissue(target.invitation, now) };
  return ok(update(state, id, () => next), next, "Invitación reenviada.");
}

/** PUT /employees/{id}/email: fixes the address of a pending invitation and sends it again. */
export function changeEmail(state: AccessState, actor: Employee, id: string, email: string, now = Date.now()): Step<Employee> {
  const error = emailError(email);
  if (error) return invalid(state, { email: error });
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  if (!target.invitation) return fail(state, 409, "La invitación ya fue aceptada. Inicia sesión.", "INVITATION_ALREADY_ACCEPTED");
  if (email.trim().toLowerCase() === target.email) return fail(state, 409, "El correo nuevo es igual al actual.", "EMAIL_UNCHANGED");
  if (emailTaken(state, email, id)) return fail(state, 409, "Ya existe un usuario con ese correo.", "EMAIL_TAKEN");
  const wait = sendWindow(state, target, now);
  if (wait) return refuse(state, wait);
  const next = { ...target, email: email.trim().toLowerCase(), invitation: reissue(target.invitation, now) };
  return ok(update(state, id, () => next), next, "Correo actualizado e invitación reenviada.");
}

/** DELETE /employees/{id}/invitation: invalidates the link and removes the pending employee. */
export function revokeInvitation(state: AccessState, actor: Employee, id: string): Step<null> {
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  if (!target.invitation) return fail(state, 409, "La invitación ya fue aceptada. Inicia sesión.", "INVITATION_ALREADY_ACCEPTED");
  return ok({ ...state, employees: state.employees.filter(employee => employee.id !== id) }, null, "Invitación revocada.");
}

const reasonError = (reason: string) => (reason.trim().length > 250 ? { reason: "El motivo admite hasta 250 caracteres." } : null);

export function deactivateEmployee(state: AccessState, actor: Employee, id: string, reason: string, now = Date.now()): Step<Employee> {
  const error = reasonError(reason);
  if (error) return invalid(state, error);
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  if (target.invitation) return fail(state, 409, "El empleado aún no aceptó su invitación. Revoca la invitación en su lugar.", "EMPLOYEE_PENDING_USE_REVOKE");
  if (target.deactivation) return fail(state, 409, "El empleado ya está desactivado.", "EMPLOYEE_ALREADY_DEACTIVATED");
  if (isAdmin(state, target) && activeAdmins(state).length <= 1) return fail(state, 409, "Debe quedar al menos un administrador activo.", "LAST_ADMIN");
  const next = { ...target, deactivation: { at: new Date(now).toISOString(), by: actor.id, reason: reason.trim() || null } };
  // Deactivating cuts the employee's sessions at once.
  const after = update(state, id, () => next);
  return ok(after.sessionId === id ? { ...after, sessionId: null } : after, next, "Empleado desactivado.");
}

export function reactivateEmployee(state: AccessState, actor: Employee, id: string): Step<Employee> {
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  if (!target.deactivation) return fail(state, 409, "El empleado no está desactivado.", "EMPLOYEE_NOT_DEACTIVATED");
  const next = { ...target, deactivation: null };
  return ok(update(state, id, () => next), next, "Empleado reactivado.");
}

export function deleteEmployee(state: AccessState, actor: Employee, id: string, reason: string): Step<null> {
  const error = reasonError(reason);
  if (error) return invalid(state, error);
  const target = guard(state, actor, id);
  if (isError(target)) return refuse(state, target);
  if (target.invitation) return fail(state, 409, "El empleado aún no aceptó su invitación. Revoca la invitación en su lugar.", "EMPLOYEE_PENDING_USE_REVOKE");
  if (isAdmin(state, target) && !target.deactivation && activeAdmins(state).length <= 1) return fail(state, 409, "Debe quedar al menos un administrador activo.", "LAST_ADMIN");
  return ok({ ...state, employees: state.employees.filter(employee => employee.id !== id) }, null, "Empleado eliminado.");
}

// --- Public invitation page ---------------------------------------------------------------------------------------

export type InvitationPreview = { firstName: string; lastName: string; email: string; expiresAt: string; termsVersion: string; privacyVersion: string };

function byToken(state: AccessState, token: string, now: number): AccessError | Employee {
  const employee = state.employees.find(candidate => candidate.invitation?.token === token);
  if (!employee) {
    return state.acceptedTokens.includes(token)
      ? { status: 409, code: "INVITATION_ALREADY_ACCEPTED", message: "La invitación ya fue aceptada. Inicia sesión." }
      : { status: 404, code: "INVITATION_INVALID", message: "El enlace de invitación no es válido." };
  }
  if (Date.parse(employee.invitation!.expiresAt) <= now) return { status: 410, code: "INVITATION_EXPIRED", message: "El enlace de invitación venció. Pide uno nuevo a quien te invitó." };
  return employee;
}

/** POST /invitations/inspect. */
export function inspectInvitation(state: AccessState, token: string, now = Date.now()): Step<InvitationPreview> {
  const employee = byToken(state, token, now);
  if (isError(employee)) return refuse(state, employee);
  return ok(state, { firstName: employee.firstName, lastName: employee.lastName, email: employee.email, expiresAt: employee.invitation!.expiresAt, termsVersion: state.termsVersion, privacyVersion: state.privacyVersion }, "");
}

export type AcceptInput = { token: string; password: string; termsVersion: string; privacyVersion: string } | { token: string; microsoft: true; termsVersion: string; privacyVersion: string };

/** POST /invitations/accept (or the Microsoft path): activates the account and opens its session, closing any other. */
export function acceptInvitation(state: AccessState, input: AcceptInput, now = Date.now()): Step<Employee> {
  const employee = byToken(state, input.token, now);
  if (isError(employee)) return refuse(state, employee);
  if (input.termsVersion !== state.termsVersion || input.privacyVersion !== state.privacyVersion) return fail(state, 409, "Los términos o la política de privacidad cambiaron. Revísalos de nuevo.", "TERMS_VERSION_MISMATCH");
  if ("password" in input) {
    if (passwordRules.some(rule => !rule.test(input.password))) return invalid(state, { password: "La contraseña no cumple los requisitos." });
    if (personalDataIn(input.password, employee)) return invalid(state, { password: "La contraseña no puede contener tu nombre, tu correo ni tu RUT." });
  }
  const next: Employee = {
    ...employee, invitation: null, activatedAt: new Date(now).toISOString(),
    password: "password" in input ? input.password : null, signInMethods: ["password" in input ? "password" : "microsoft"],
  };
  const after = update(state, employee.id, () => next);
  return ok({ ...after, sessionId: employee.id, acceptedTokens: [...state.acceptedTokens, input.token] }, next, "Invitación aceptada.");
}

// --- Sample data ----------------------------------------------------------------------------------------------------

let counter = 0;
function newId() {
  counter += 1;
  return `${Date.now().toString(16)}-${counter.toString(16).padStart(4, "0")}-${Math.random().toString(16).slice(2, 10)}`;
}
function newToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** The password every sample account uses, shown on the login page while there is no backend. */
export const DEMO_PASSWORD = "Ecosistema#2026";
export const DEMO_ADMIN_EMAIL = "pcontreras@aecon.cl";

export function seedAccess(now = Date.now()): AccessState {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();
  const roles: Role[] = [
    { id: "role-admin", name: "Administrador", description: "Rol del sistema: tiene todos los permisos.", isSystem: true, permissions: [...allPermissions], createdAt: at(2400) },
    { id: "role-rrhh", name: "Recursos Humanos", description: "Invita, edita y desactiva empleados.", isSystem: false, permissions: ["roles.read", "employees.read", "employees.invite", "employees.manage", "employees.deactivate"], createdAt: at(2000) },
    { id: "role-supervisor", name: "Supervisor", description: "Ve el equipo y sus roles.", isSystem: false, permissions: ["roles.read", "employees.read"], createdAt: at(1900) },
    { id: "role-accesos", name: "Gestor de accesos", description: "Mantiene los roles y sus permisos.", isSystem: false, permissions: ["roles.read", "roles.manage"], createdAt: at(1500) },
    { id: "role-soporte", name: "Soporte técnico", description: "Diagnóstico de correo y trabajos del sistema.", isSystem: false, permissions: ["notifications.test", "system.jobs"], createdAt: at(1200) },
    { id: "role-colaborador", name: "Colaborador", description: null, isSystem: false, permissions: ["employees.read"], createdAt: at(800) },
  ];
  type Seed = [string, string, string, number, string[], { hoursAgo: number; state: "active" | "deactivated" | "pending" | "expired" | "bounced"; microsoft?: boolean; reason?: string }];
  const people: Seed[] = [
    ["Pablo", "Contreras", "pcontreras@aecon.cl", 15234876, ["role-admin"], { hoursAgo: 2300, state: "active", microsoft: true }],
    ["Maridel", "Rojas", "mrojas@aecon.cl", 13876543, ["role-rrhh"], { hoursAgo: 1800, state: "active" }],
    ["Paula", "Araya", "paraya@aecon.cl", 18765432, ["role-rrhh"], { hoursAgo: 1100, state: "active", microsoft: true }],
    ["Sebastián", "Núñez", "snunez@aecon.cl", 19456321, ["role-colaborador"], { hoursAgo: 900, state: "active" }],
    ["Vladimir", "Peña", "vpena@aecon.cl", 12345678, ["role-supervisor"], { hoursAgo: 1700, state: "active" }],
    ["Carlos", "Fuentes", "cfuentes@aecon.cl", 16789012, ["role-supervisor"], { hoursAgo: 1600, state: "deactivated", reason: "Término de contrato en la obra Los Andes." }],
    ["Andrés", "Molina", "amolina@aecon.cl", 14567890, ["role-accesos", "role-supervisor"], { hoursAgo: 1300, state: "active" }],
    ["Jorge", "Muñoz", "jmunoz@aecon.cl", 11223344, ["role-soporte"], { hoursAgo: 1000, state: "active" }],
    ["Rodrigo", "Silva", "rsilva@aecon.cl", 17654321, ["role-supervisor"], { hoursAgo: 700, state: "active" }],
    ["Camila", "Torres", "ctorres@aecon.cl", 20123456, ["role-colaborador"], { hoursAgo: 2, state: "pending" }],
    ["Felipe", "Rivas", "frivas@aecon.cl", 19876543, ["role-colaborador"], { hoursAgo: 96, state: "expired" }],
    ["Ignacio", "Pérez", "iperez@aecon.cll", 18234567, ["role-supervisor"], { hoursAgo: 20, state: "bounced" }],
  ];
  const employees = people.map(([firstName, lastName, email, rutBody, roleIds, seed], index): Employee => {
    const created = at(seed.hoursAgo);
    const pending = seed.state === "pending" || seed.state === "expired" || seed.state === "bounced";
    return {
      id: `emp-${index + 1}`, email, firstName, lastName, rut: `${rutBody}-${rutDv(rutBody)}`, roleIds,
      password: pending ? null : DEMO_PASSWORD, signInMethods: pending ? [] : seed.microsoft ? ["password", "microsoft"] : ["password"],
      createdAt: created, createdBy: index === 0 ? null : "emp-1", activatedAt: pending ? null : at(seed.hoursAgo - 20),
      deactivation: seed.state === "deactivated" ? { at: at(120), by: "emp-2", reason: seed.reason ?? null } : null,
      invitation: pending ? {
        token: `demo-${firstName.toLowerCase()}-${index + 1}`, expiresAt: new Date(Date.parse(created) + INVITATION_HOURS * HOUR).toISOString(), sends: [created],
        email: { status: seed.state === "bounced" ? "bounced" : "delivered", updatedAt: at(seed.hoursAgo - 0.05) },
      } : null,
      failedLogins: 0, lockedUntil: null,
    };
  });
  return { roles, employees, sessionId: null, acceptedTokens: [], termsVersion: "2026-10", privacyVersion: "2026-10" };
}
