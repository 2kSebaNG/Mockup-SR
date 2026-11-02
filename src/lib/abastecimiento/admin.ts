import { normalizeRut } from "@/lib/access";
import type { components } from "./api/schema";
import { listVendorCategories, vendorOf, type BusinessUnit, type ChartAccount, type Client, type Company, type ProcurementState, type TaxRate, type Vendor, type VendorCategory } from "./data";
import type { StoredVendor } from "./seed-vendors";

// The writes of Administración (phase 1 of docs/plan-abastecimiento.md) as budget-control-api answers them: each takes
// the state and the request body, and returns the next state with the endpoint's answer, or throws `ApiFailure` with
// the status and the API's own (English) message, which `apiErrorText` turns into Spanish for the screen.

type Schemas = components["schemas"];
type Change<T> = { state: ProcurementState; data: T };

export class ApiFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiFailure";
  }
}

const same = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
const required = (value: string | undefined, what: string) => {
  if (value !== undefined && !value.trim()) throw new ApiFailure(400, `${what} should not be empty`);
};
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** A RUT as stored ("12345678-5"), or a 400 when it is not valid. */
const validRut = (value: string) => {
  const rut = normalizeRut(value);
  if (!rut) throw new ApiFailure(400, "taxId must be a valid RUT");
  return rut;
};

// --- Business units --------------------------------------------------------------------------------------------

export function createBusinessUnit(state: ProcurementState, body: { name: string; description?: string | undefined }): Change<BusinessUnit> {
  required(body.name, "name");
  if (state.businessUnits.some(unit => same(unit.name, body.name))) throw new ApiFailure(409, "A business unit with that name already exists");
  const unit: BusinessUnit = { id: newId("bu"), name: body.name.trim(), description: body.description?.trim() || null, active: true };
  return { state: { ...state, businessUnits: [...state.businessUnits, unit] }, data: unit };
}

export function updateBusinessUnit(state: ProcurementState, id: string, body: { name?: string | undefined; description?: string | null | undefined; active?: boolean | undefined }): Change<BusinessUnit> {
  const unit = state.businessUnits.find(candidate => candidate.id === id);
  if (!unit) throw new ApiFailure(404, "Business unit not found");
  required(body.name, "name");
  if (body.name !== undefined && state.businessUnits.some(other => other.id !== id && same(other.name, body.name!))) throw new ApiFailure(409, "A business unit with that name already exists");
  const next: BusinessUnit = {
    ...unit, ...(body.name !== undefined && { name: body.name.trim() }), ...(body.description !== undefined && { description: body.description?.trim() || null }),
    ...(body.active !== undefined && { active: body.active }),
  };
  return { state: { ...state, businessUnits: state.businessUnits.map(candidate => (candidate.id === id ? next : candidate)) }, data: next };
}

// --- Chart of accounts -----------------------------------------------------------------------------------------

const lastNumber = (code: string) => Number(code.split(".").at(-1));
const byCode = (a: ChartAccount, b: ChartAccount) => a.code.localeCompare(b.code, "es", { numeric: true });

/**
 * Gives each child of `parentId`, in `order`, a code: the parent's code and the numbers in `pool` in order (a root
 * gets the bare number), then does the same down every subtree, so a moved account carries its sub-accounts along.
 */
function recode(accounts: ChartAccount[], parentId: string | null, order: string[], pool: number[]): ChartAccount[] {
  const codes = new Map<string, string>();
  const prefixOf = (id: string | null) => (id === null ? "" : `${codes.get(id) ?? accounts.find(account => account.id === id)!.code}.`);
  const assign = (parent: string | null, ids: string[], numbers: number[]) => {
    ids.forEach((id, index) => {
      codes.set(id, `${prefixOf(parent)}${numbers[index]!}`);
      const children = accounts.filter(account => account.parentAccountId === id).sort(byCode);
      assign(id, children.map(child => child.id), children.map(child => lastNumber(child.code)));
    });
  };
  assign(parentId, order, pool);
  return accounts.map(account => (codes.has(account.id) ? { ...account, code: codes.get(account.id)! } : account));
}

export function createChartAccount(state: ProcurementState, body: { name: string; parentAccountId?: string | undefined }): Change<ChartAccount> {
  required(body.name, "name");
  const parent = body.parentAccountId ? state.chartAccounts.find(account => account.id === body.parentAccountId) : null;
  if (body.parentAccountId && !parent) throw new ApiFailure(400, "The parent account does not exist");
  const siblings = state.chartAccounts.filter(account => account.parentAccountId === (parent?.id ?? null));
  const number = Math.max(0, ...siblings.map(account => lastNumber(account.code))) + 1;
  // A new account is what its parent is (a sub-account of Ingresos is income); a root one starts as a cost.
  const account: ChartAccount = { id: newId("ca"), code: parent ? `${parent.code}.${number}` : String(number), name: body.name.trim(), parentAccountId: parent?.id ?? null, active: true, kind: parent?.kind ?? "COST" };
  return { state: { ...state, chartAccounts: [...state.chartAccounts, account] }, data: account };
}

/** Renames an account, changes its kind, and/or moves it: under `parentAccountId` (null = root) at `position` among its new siblings. */
export function updateChartAccount(state: ProcurementState, id: string, body: { name?: string | undefined; parentAccountId?: string | null | undefined; position?: number | undefined; kind?: "INCOME" | "COST" | undefined }): Change<ChartAccount> {
  const account = state.chartAccounts.find(candidate => candidate.id === id);
  if (!account) throw new ApiFailure(404, "Chart account not found");
  required(body.name, "name");
  let accounts = state.chartAccounts.map(candidate => (candidate.id === id ? { ...candidate, ...(body.name !== undefined && { name: body.name.trim() }), ...(body.kind && { kind: body.kind }) } : candidate));

  const parentId = body.parentAccountId === undefined ? account.parentAccountId : body.parentAccountId;
  const moving = parentId !== account.parentAccountId || body.position !== undefined;
  if (moving) {
    if (parentId !== null) {
      if (!accounts.some(candidate => candidate.id === parentId)) throw new ApiFailure(400, "The parent account does not exist");
      // Walking up from the new parent must not reach the account itself.
      for (let at: string | null = parentId; at; at = accounts.find(candidate => candidate.id === at)?.parentAccountId ?? null) {
        if (at === id) throw new ApiFailure(400, "An account cannot be moved inside itself");
      }
    }
    const oldSiblings = accounts.filter(candidate => candidate.parentAccountId === account.parentAccountId && candidate.id !== id).sort(byCode);
    const newSiblings = accounts.filter(candidate => candidate.parentAccountId === parentId && candidate.id !== id).sort(byCode);
    const position = Math.min(Math.max(0, body.position ?? newSiblings.length), newSiblings.length);
    const order = [...newSiblings.map(sibling => sibling.id)];
    order.splice(position, 0, id);
    accounts = accounts.map(candidate => (candidate.id === id ? { ...candidate, parentAccountId: parentId } : candidate));
    if (parentId === account.parentAccountId) {
      // A reorder: the same numbers, handed out in the new order.
      const pool = [...oldSiblings.map(sibling => lastNumber(sibling.code)), lastNumber(account.code)].sort((a, b) => a - b);
      accounts = recode(accounts, parentId, order, pool);
    } else {
      // Where it leaves, the others close the gap; where it lands, the numbers there plus the next one.
      const leftPool = [...oldSiblings.map(sibling => lastNumber(sibling.code)), lastNumber(account.code)].sort((a, b) => a - b).slice(0, oldSiblings.length);
      accounts = recode(accounts, account.parentAccountId, oldSiblings.map(sibling => sibling.id), leftPool);
      const landed = newSiblings.map(sibling => lastNumber(sibling.code));
      const pool = [...landed, Math.max(0, ...landed) + 1].sort((a, b) => a - b);
      accounts = recode(accounts, parentId, order, pool);
    }
  }
  return { state: { ...state, chartAccounts: accounts }, data: accounts.find(candidate => candidate.id === id)! };
}

// --- Tax rates -------------------------------------------------------------------------------------------------

const firstOf = (rates: TaxRate[], kind: TaxRate["kind"]) => rates.filter(rate => rate.kind === kind).sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
const percentProblem = (percent: number) => !Number.isFinite(percent) || percent < 0 || percent > 100 || Math.round(percent * 100) / 100 !== percent;

export function createTaxRate(state: ProcurementState, body: Schemas["CreateTaxRateRequest"]): Change<TaxRate> {
  if (percentProblem(body.percent)) throw new ApiFailure(400, "percent must be between 0 and 100 with up to two decimals");
  if (state.taxRates.some(rate => rate.kind === body.kind && rate.validFrom === body.validFrom)) throw new ApiFailure(409, "A rate of that tax already starts on that day");
  const first = firstOf(state.taxRates, body.kind);
  if (first && body.validFrom < first.validFrom) throw new ApiFailure(400, "A rate cannot start before the first rate of its tax");
  const rate: TaxRate = { id: newId("tax"), kind: body.kind, validFrom: body.validFrom, percent: body.percent };
  return { state: { ...state, taxRates: [...state.taxRates, rate] }, data: rate };
}

export function updateTaxRate(state: ProcurementState, id: string, body: Schemas["UpdateTaxRateRequest"]): Change<TaxRate> {
  const rate = state.taxRates.find(candidate => candidate.id === id);
  if (!rate) throw new ApiFailure(404, "Tax rate not found");
  const first = firstOf(state.taxRates, rate.kind)!;
  if (body.percent !== undefined && percentProblem(body.percent)) throw new ApiFailure(400, "percent must be between 0 and 100 with up to two decimals");
  if (body.validFrom !== undefined && body.validFrom !== rate.validFrom) {
    if (first.id === id) throw new ApiFailure(400, "The first rate of a tax keeps its date");
    if (body.validFrom <= first.validFrom) throw new ApiFailure(400, "A rate cannot start before the first rate of its tax");
    if (state.taxRates.some(other => other.id !== id && other.kind === rate.kind && other.validFrom === body.validFrom)) throw new ApiFailure(409, "A rate of that tax already starts on that day");
  }
  const next: TaxRate = { ...rate, ...(body.validFrom !== undefined && { validFrom: body.validFrom }), ...(body.percent !== undefined && { percent: body.percent }) };
  return { state: { ...state, taxRates: state.taxRates.map(candidate => (candidate.id === id ? next : candidate)) }, data: next };
}

export function deleteTaxRate(state: ProcurementState, id: string): Change<null> {
  const rate = state.taxRates.find(candidate => candidate.id === id);
  if (!rate) throw new ApiFailure(404, "Tax rate not found");
  if (firstOf(state.taxRates, rate.kind)!.id === id) throw new ApiFailure(400, "The first rate of a tax cannot be removed");
  return { state: { ...state, taxRates: state.taxRates.filter(candidate => candidate.id !== id) }, data: null };
}

// --- Company ---------------------------------------------------------------------------------------------------

/** PATCH /company: a field left out stays; a threshold set to null is turned off. */
export type CompanyPatch = {
  legalName?: string | undefined; taxId?: string | undefined; address?: string | undefined; businessLine?: string | undefined; website?: string | undefined;
  contactEmails?: string | undefined; payrollChartAccountId?: string | undefined;
  alertVarianceAmount?: number | null | undefined; alertVariancePercent?: number | null | undefined; alertMinProfitability?: number | null | undefined;
};

export function updateCompany(state: ProcurementState, body: CompanyPatch): Change<Company> {
  const patch = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)) as CompanyPatch;
  if (patch.taxId) patch.taxId = validRut(patch.taxId);
  if (patch.payrollChartAccountId && !state.chartAccounts.some(account => account.id === patch.payrollChartAccountId)) throw new ApiFailure(400, "The payroll chart account does not exist");
  // Thresholds are shares (0.1 is 10%) and pesos; none can be negative. The return may be anything up to 100%.
  for (const key of ["alertVarianceAmount", "alertVariancePercent", "alertMinProfitability"] as const) {
    const value = patch[key];
    if (value !== undefined && value !== null && (value < 0 || (key === "alertMinProfitability" && value > 1))) throw new ApiFailure(400, `${key} must be a share between 0 and 1`);
  }
  const company = { ...state.company, ...patch } as Company;
  return { state: { ...state, company }, data: company };
}

// --- Clients ---------------------------------------------------------------------------------------------------

const SIGLA_SKIP = new Set(["de", "del", "y", "e", "spa", "sa", "s.a.", "ltda", "ltda.", "limitada", "eirl"]);

/**
 * GET /clients/suggest-sigla: three letters from the name (the initials of its words, completed with the next
 * letters of the last word when it has fewer than three), with a number when another client has it.
 */
export function suggestClientSigla(state: ProcurementState, name: string): string {
  const words = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/\s+/).filter(word => word && !SIGLA_SKIP.has(word.toLowerCase()))
    .map(word => word.replace(/[^A-Za-z0-9]/g, "").toUpperCase()).filter(Boolean);
  let base = words.map(word => word[0]).join("").slice(0, 3);
  const last = words.at(-1) ?? "CLI";
  for (let index = 1; base.length < 3 && index < last.length; index += 1) base += last[index];
  base = base.padEnd(3, "X");
  const taken = new Set(state.clients.map(client => client.sigla?.toUpperCase()));
  if (!taken.has(base)) return base;
  for (let number = 2; ; number += 1) if (!taken.has(`${base}${number}`)) return `${base}${number}`;
}

function clientChecks(state: ProcurementState, id: string | null, body: { taxId?: string | undefined; sigla?: string | undefined }) {
  const taxId = body.taxId?.trim() ? validRut(body.taxId) : undefined;
  if (taxId && state.clients.some(client => client.id !== id && client.taxId === taxId)) throw new ApiFailure(409, "A client with that tax ID already exists");
  const sigla = body.sigla?.trim().toUpperCase();
  if (sigla !== undefined && sigla !== "") {
    if (!/^[A-Z0-9]{2,10}$/.test(sigla)) throw new ApiFailure(400, "sigla must be 2 to 10 letters or digits");
    if (state.clients.some(client => client.id !== id && client.sigla?.toUpperCase() === sigla)) throw new ApiFailure(409, "That sigla is already used by another client");
  }
  return { taxId, sigla: sigla || undefined };
}

export function createClient(state: ProcurementState, body: Schemas["CreateClientRequest"]): Change<Client> {
  required(body.name, "name");
  const { taxId, sigla } = clientChecks(state, null, body);
  const client: Client = { id: newId("cl"), name: body.name.trim(), taxId: taxId ?? null, sigla: sigla ?? suggestClientSigla(state, body.name), active: true };
  return { state: { ...state, clients: [...state.clients, client] }, data: client };
}

export function updateClient(state: ProcurementState, id: string, body: Schemas["UpdateClientRequest"]): Change<Client> {
  const client = state.clients.find(candidate => candidate.id === id);
  if (!client) throw new ApiFailure(404, "Client not found");
  required(body.name, "name");
  const { taxId, sigla } = clientChecks(state, id, body);
  const next: Client = {
    ...client, ...(body.name !== undefined && { name: body.name.trim() }), ...(body.taxId !== undefined && { taxId: taxId ?? null }),
    ...(sigla !== undefined && { sigla }), ...(body.active !== undefined && { active: body.active }),
  };
  return { state: { ...state, clients: state.clients.map(candidate => (candidate.id === id ? next : candidate)) }, data: next };
}

// --- Vendors ---------------------------------------------------------------------------------------------------

/** The ids of the named categories, adding to the pool the names it does not have yet (whatever their case). */
function categoryIdsFor(state: ProcurementState, names: string[]): { state: ProcurementState; ids: string[] } {
  let pool = state.vendorCategories;
  const ids = names.map(name => name.trim().replace(/\s+/g, " ")).filter(Boolean).map(name => {
    const found = pool.find(category => same(category.name, name));
    if (found) return found.id;
    const created = { id: newId("vc"), name };
    pool = [...pool, created];
    return created.id;
  });
  return { state: { ...state, vendorCategories: pool }, ids: [...new Set(ids)] };
}

function vendorTaxIdCheck(state: ProcurementState, id: string | null, taxId: string | undefined) {
  if (taxId === undefined) return undefined;
  const rut = validRut(taxId);
  if (state.vendors.some(vendor => vendor.id !== id && vendor.taxId === rut)) throw new ApiFailure(409, "A vendor with that tax ID already exists");
  return rut;
}

const contactsOf = (id: string, contacts: Schemas["VendorContactInput"][]) =>
  contacts.map((contact, position) => ({ id: `${id}-c${position + 1}`, name: contact.name.trim(), phone: contact.phone ?? null, email: contact.email ?? null, role: contact.role ?? null, position }));
const accountsOf = (id: string, accounts: Schemas["VendorPaymentAccountInput"][]) =>
  accounts.map((account, position) => ({ id: `${id}-a${position + 1}`, ...account, position }));

export function createVendor(state: ProcurementState, body: Schemas["CreateVendorRequest"]): Change<Vendor> {
  required(body.name, "name");
  if (body.contacts.length === 0) throw new ApiFailure(400, "A vendor needs at least one contact");
  if (body.paymentAccounts.length === 0) throw new ApiFailure(400, "A vendor needs at least one payment account");
  const taxId = vendorTaxIdCheck(state, null, body.taxId)!;
  const id = newId("ven");
  const withCategories = categoryIdsFor(state, body.categories);
  const vendor: StoredVendor = {
    id, name: body.name.trim(), taxId, active: true, legalName: body.legalName, businessActivity: body.businessActivity ?? null, creditDays: body.creditDays,
    address: body.address, comuna: body.comuna, region: body.region, defaultModality: body.defaultModality, defaultDeliveryTerms: body.defaultDeliveryTerms,
    contacts: contactsOf(id, body.contacts), paymentAccounts: accountsOf(id, body.paymentAccounts), categoryIds: withCategories.ids, createdAt: new Date().toISOString().slice(0, 10),
  };
  const next = { ...withCategories.state, vendors: [...state.vendors, vendor] };
  return { state: next, data: vendorOf(next, vendor) };
}

export function updateVendor(state: ProcurementState, id: string, body: Schemas["UpdateVendorRequest"]): Change<Vendor> {
  const vendor = state.vendors.find(candidate => candidate.id === id);
  if (!vendor) throw new ApiFailure(404, "Vendor not found");
  required(body.name, "name");
  const taxId = vendorTaxIdCheck(state, id, body.taxId);
  const withCategories = body.categories ? categoryIdsFor(state, body.categories) : { state, ids: vendor.categoryIds };
  const plain = (["legalName", "businessActivity", "creditDays", "address", "comuna", "region", "defaultModality", "defaultDeliveryTerms", "active"] as const)
    .filter(key => body[key] !== undefined).map(key => [key, body[key]]);
  const updated: StoredVendor = {
    ...vendor, ...Object.fromEntries(plain), ...(body.name !== undefined && { name: body.name.trim() }), ...(taxId && { taxId }),
    categoryIds: withCategories.ids,
    ...(body.contacts && { contacts: contactsOf(id, body.contacts) }), ...(body.paymentAccounts && { paymentAccounts: accountsOf(id, body.paymentAccounts) }),
  };
  const next = { ...withCategories.state, vendors: state.vendors.map(candidate => (candidate.id === id ? updated : candidate)) };
  return { state: next, data: vendorOf(next, updated) };
}

/** POST /vendors/categories: a category already in the pool (whatever its case) is answered as it is, not repeated. */
export function createVendorCategory(state: ProcurementState, name: string): Change<VendorCategory> {
  required(name, "name");
  const { state: next, ids } = categoryIdsFor(state, [name]);
  return { state: next, data: listVendorCategories(next).find(category => category.id === ids[0])! };
}

export function renameVendorCategory(state: ProcurementState, id: string, name: string): Change<VendorCategory> {
  required(name, "name");
  if (!state.vendorCategories.some(category => category.id === id)) throw new ApiFailure(404, "Vendor category not found");
  if (state.vendorCategories.some(category => category.id !== id && same(category.name, name))) throw new ApiFailure(409, `A category named "${name.trim()}" already exists`);
  const next = { ...state, vendorCategories: state.vendorCategories.map(category => (category.id === id ? { ...category, name: name.trim() } : category)) };
  return { state: next, data: listVendorCategories(next).find(category => category.id === id)! };
}

export function deleteVendorCategory(state: ProcurementState, id: string): Change<null> {
  const used = state.vendors.filter(vendor => vendor.categoryIds.includes(id)).length;
  if (used > 0) throw new ApiFailure(409, `That category is still used by ${used} vendors`);
  return { state: { ...state, vendorCategories: state.vendorCategories.filter(category => category.id !== id) }, data: null };
}
