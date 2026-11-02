import { rutDv } from "@/lib/access";
import type { components } from "./api/schema";
import { seedVendors, type StoredVendor, type StoredVendorCategory, type VendorOrderSample, type VendorPriceSample } from "./seed-vendors";

// The Abastecimiento data until the screens call budget-control-api: the catalogs every view reads (business units,
// chart accounts, tax rates, the company, clients, deals, projects and people), shaped exactly as the API's schemas
// (`api/schema.d.ts`, copied from budget-control-web). Pure: the reads take the state and answer what the endpoint
// would. Each phase of docs/plan-abastecimiento.md adds the data and the operations of its own views.

type Schemas = components["schemas"];
export type BusinessUnit = Schemas["BusinessUnit"];
export type ChartAccount = Schemas["ChartAccountSummary"];
export type TaxRate = Schemas["TaxRate"];
export type CurrentTaxRates = Schemas["CurrentTaxRates"];
export type Company = Schemas["Company"];
export type Client = Schemas["Client"];
export type Deal = Schemas["Deal"];
export type DealSummary = Schemas["DealSummary"];
export type Vendor = Schemas["Vendor"];
export type VendorCategory = Schemas["VendorCategory"];
export type VendorPage = Schemas["VendorPage"];
export type VendorMetricsResult = Schemas["VendorMetricsResult"];
export type KindConflict = Schemas["ChartAccountKindConflict"];
export type ProjectStatus = Schemas["ProjectStatus"];
export type ProjectSummary = Schemas["ProjectSummary"];
export type ProjectListItem = Schemas["ProjectListItem"];
export type Person = Schemas["Person"];

/** A project as it is stored; the list item joins its deal, client and unit. */
export type Project = { id: string; code: string; name: string; status: ProjectStatus; startDate: string | null; endDate: string | null; dealId: string; businessUnitId: string | null };

/** What is booked to an account (sales and real costs): what tells whether its kind fits. */
export type AccountActivity = { accountId: string; salesCount: number; salesTotal: number; costCount: number; costTotal: number };

export type ProcurementState = {
  businessUnits: BusinessUnit[];
  chartAccounts: ChartAccount[];
  /** Until the report brings real figures (phase 4), a sample of what is booked to some accounts. */
  accountActivity: AccountActivity[];
  taxRates: TaxRate[];
  company: Company;
  clients: Client[];
  deals: Deal[];
  projects: Project[];
  people: Person[];
  vendorCategories: StoredVendorCategory[];
  vendors: StoredVendor[];
  /** Until phase 2 brings the purchase orders, the approved and paid orders the vendor metrics add up. */
  vendorOrders: VendorOrderSample[];
  vendorPrices: VendorPriceSample[];
};

/** "12345678" ⇒ "12345678-5": a valid RUT for the sample. */
const rut = (body: number) => `${body}-${rutDv(body)}`;

export function seedProcurement(): ProcurementState {
  const units = ["Comercial", "Ejecución", "Abastecimiento", "Finanzas", "Ingeniería", "Prevención de riesgos", "Recursos Humanos", "Operaciones", "Gerencia general"];
  const businessUnits: BusinessUnit[] = units.map((name, index) => ({ id: `bu-${index + 1}`, name, description: null, active: name !== "Gerencia general" }));
  businessUnits[1]!.description = "Obras en terreno y su personal.";

  // [id, code, name, parent, kind]
  const accounts: [string, string, string, string | null, "INCOME" | "COST" | undefined][] = [
    ["ca-ing", "4", "Ingresos", null, "INCOME"],
    ["ca-ing-ventas", "4.1", "Ventas por estados de pago", "ca-ing", "INCOME"],
    ["ca-ing-otros", "4.2", "Otros ingresos", "ca-ing", "INCOME"],
    ["ca-cos", "5", "Costos", null, "COST"],
    ["ca-rem", "5.1", "Remuneraciones", "ca-cos", "COST"],
    ["ca-mat", "5.2", "Materiales", "ca-cos", "COST"],
    ["ca-arr", "5.3", "Arriendo - Equipos y Vehículos", "ca-cos", "COST"],
    ["ca-sub", "5.4", "Subcontratos", "ca-cos", "COST"],
    ["ca-cch", "5.5", "Caja Chica", "ca-cos", "COST"],
    ["ca-cch-ali", "5.5.1", "Alimentación", "ca-cch", "COST"],
    ["ca-cch-com", "5.5.2", "Combustible", "ca-cch", "COST"],
    ["ca-cch-mov", "5.5.3", "Movilización", "ca-cch", "COST"],
    ["ca-epp", "5.6", "Elementos de protección personal", "ca-cos", "COST"],
  ];
  const chartAccounts: ChartAccount[] = accounts.map(([id, code, name, parentAccountId, kind]) => ({ id, code, name, parentAccountId, active: true, ...(kind && { kind }) }));
  // "Otros ingresos" only has costs (fixed by marking it a cost) and "Subcontratos" has both: no kind fits it.
  const accountActivity: AccountActivity[] = [
    { accountId: "ca-ing-ventas", salesCount: 14, salesTotal: 1_212_000_000, costCount: 0, costTotal: 0 },
    { accountId: "ca-ing-otros", salesCount: 0, salesTotal: 0, costCount: 3, costTotal: 4_850_000 },
    { accountId: "ca-sub", salesCount: 2, salesTotal: 38_000_000, costCount: 9, costTotal: 212_400_000 },
    { accountId: "ca-mat", salesCount: 0, salesTotal: 0, costCount: 41, costTotal: 96_300_000 },
  ];

  // The retention of honorarios goes up every January until 2028 (Ley 21.133).
  const taxRates: TaxRate[] = [
    { id: "tax-iva", kind: "IVA", validFrom: "2014-10-01", percent: 19 },
    { id: "tax-hon-2025", kind: "HONORARIOS_RETENTION", validFrom: "2025-01-01", percent: 14.5 },
    { id: "tax-hon-2026", kind: "HONORARIOS_RETENTION", validFrom: "2026-01-01", percent: 15.25 },
  ];

  const company: Company = {
    id: "company-1", name: "AECON", legalName: "AECON SpA", taxId: rut(76543210), address: "Av. Apoquindo 4501, oficina 1201, Las Condes",
    businessLine: "Ingeniería y construcción", website: "www.aecon.cl", contactEmails: "proveedores@aecon.cl - denuncias@aecon.cl", active: true,
    payrollChartAccountId: "ca-rem", alertVarianceAmount: 5_000_000, alertVariancePercent: 0.1, alertMinProfitability: 0.12,
  };

  const clients: Client[] = [
    { id: "cl-1", name: "Minera Los Andes", taxId: rut(96812450), sigla: "MLA", active: true },
    { id: "cl-2", name: "Constructora Pacífico", taxId: rut(77345120), sigla: "CPA", active: true },
    { id: "cl-3", name: "Sanitaria del Sur", taxId: rut(96603890), sigla: "SDS", active: true },
    { id: "cl-4", name: "Energía Austral", taxId: rut(76998120), sigla: "EAU", active: false },
  ];

  const deals: Deal[] = [
    { id: "deal-1", clientId: "cl-1", code: "MLA2603", name: "Mantención planta concentradora", initialNetSaleAmount: 1_480_000_000, awardedAt: "2026-03-02", status: "ACTIVE" },
    { id: "deal-2", clientId: "cl-2", code: "CPA2605", name: "Obras civiles edificio Pacífico", initialNetSaleAmount: 920_000_000, awardedAt: "2026-05-18", status: "ACTIVE" },
    { id: "deal-3", clientId: "cl-3", code: "SDS2510", name: "Colector de aguas lluvia Temuco", initialNetSaleAmount: 610_000_000, awardedAt: "2025-10-06", status: "ACTIVE" },
    { id: "deal-4", clientId: "cl-4", code: "EAU2408", name: "Montaje subestación Magallanes", initialNetSaleAmount: 340_000_000, awardedAt: "2024-08-12", status: "CLOSED" },
  ];

  const projects: Project[] = [
    { id: "prj-1", code: "MLA260301", name: "Mantención molinos SAG", status: "ACTIVE", startDate: "2026-03-16", endDate: "2027-03-15", dealId: "deal-1", businessUnitId: "bu-2" },
    { id: "prj-2", code: "MLA260302", name: "Cambio de revestimientos", status: "ACTIVE", startDate: "2026-04-01", endDate: "2026-12-31", dealId: "deal-1", businessUnitId: "bu-2" },
    { id: "prj-3", code: "CPA260501", name: "Fundaciones y estructura", status: "ACTIVE", startDate: "2026-06-01", endDate: "2027-05-31", dealId: "deal-2", businessUnitId: "bu-2" },
    { id: "prj-4", code: "CPA260502", name: "Ingeniería de detalle", status: "CLOSING", startDate: "2026-05-20", endDate: "2026-10-31", dealId: "deal-2", businessUnitId: "bu-5" },
    { id: "prj-5", code: "SDS251001", name: "Colector principal", status: "ACTIVE", startDate: "2025-11-03", endDate: "2026-12-18", dealId: "deal-3", businessUnitId: "bu-2" },
    { id: "prj-6", code: "EAU240801", name: "Montaje subestación", status: "CLOSED", startDate: "2024-09-02", endDate: "2025-07-31", dealId: "deal-4", businessUnitId: "bu-2" },
  ];

  const people: Person[] = [
    ["Daniela Vera", 17345678], ["Tomás Bravo", 15987654], ["Luis Cárcamo", 13456789], ["Marcela Soto", 16234567],
    ["Héctor Riquelme", 12876543], ["Javiera Lagos", 19234567], ["Pedro Alarcón", 14765432],
  ].map(([name, body], index) => ({ id: `per-${index + 1}`, name: name as string, taxId: rut(body as number), active: index !== 6 }));

  return { businessUnits, chartAccounts, accountActivity, taxRates, company, clients, deals, projects, people, ...seedVendors() };
}

// --- Reading, as the API answers -------------------------------------------------------------------------------

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, "es");

/** GET /business-units: the active ones, or all with includeInactive. */
export const listBusinessUnits = (state: ProcurementState, includeInactive = false) =>
  state.businessUnits.filter(unit => includeInactive || unit.active).sort(byName);

/** GET /chart-accounts: every account, by code. */
export const listChartAccounts = (state: ProcurementState) =>
  [...state.chartAccounts].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));

/** GET /tax-rates: every rate, newest first within each tax. */
export const listTaxRates = (state: ProcurementState) =>
  [...state.taxRates].sort((a, b) => a.kind.localeCompare(b.kind) || b.validFrom.localeCompare(a.validFrom));

/** GET /tax-rates/current?date=: the rate of each tax on that day (the latest that started on or before it). */
export function currentTaxRates(state: ProcurementState, date: string): CurrentTaxRates {
  const on = (kind: TaxRate["kind"]) =>
    state.taxRates.filter(rate => rate.kind === kind && rate.validFrom <= date).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]?.percent ?? null;
  return { date, iva: on("IVA"), honorariosRetention: on("HONORARIOS_RETENTION") };
}

/** GET /clients: the active ones, or all with includeInactive. */
export const listClients = (state: ProcurementState, includeInactive = false) =>
  state.clients.filter(client => includeInactive || client.active).sort(byName);

/** GET /deals: every deal with its client's name, its value and its projects, newest code first. */
export const listDeals = (state: ProcurementState): DealSummary[] =>
  [...state.deals].sort((a, b) => b.code.localeCompare(a.code)).map(deal => {
    const projects = state.projects.filter(project => project.dealId === deal.id);
    return {
      ...deal, clientName: state.clients.find(client => client.id === deal.clientId)?.name ?? null,
      // Amendments arrive with the deal page (phase 3); until then the value is the initial one.
      currentValue: deal.initialNetSaleAmount, projectCount: projects.length, openProjectCount: projects.filter(project => project.status !== "CLOSED").length,
    };
  });

/** GET /projects: the projects as a summary, by code. */
export const listProjects = (state: ProcurementState): ProjectSummary[] =>
  [...state.projects].sort((a, b) => a.code.localeCompare(b.code)).map(({ id, code, name, status, startDate, endDate }) => ({ id, code, name, status, startDate, endDate }));

/** A project with its deal, client and unit, as GET /projects/page lists it. */
export function projectListItem(state: ProcurementState, project: Project): ProjectListItem {
  const deal = state.deals.find(candidate => candidate.id === project.dealId);
  const client = state.clients.find(candidate => candidate.id === deal?.clientId);
  const unit = state.businessUnits.find(candidate => candidate.id === project.businessUnitId);
  return {
    id: project.id, code: project.code, name: project.name, status: project.status, startDate: project.startDate, endDate: project.endDate,
    dealId: project.dealId, dealCode: deal?.code ?? "", dealName: deal?.name ?? "",
    clientId: client?.id ?? null, clientName: client?.name ?? null, businessUnitId: unit?.id ?? null, businessUnitName: unit?.name ?? null,
  };
}

/** GET /people: every person, by name. */
export const listPeople = (state: ProcurementState) => [...state.people].sort(byName);

/** GET /chart-accounts/kind-conflicts: the accounts whose kind does not match what is booked to them. */
export function listKindConflicts(state: ProcurementState): KindConflict[] {
  return listChartAccounts(state).flatMap(account => {
    const activity = state.accountActivity.find(entry => entry.accountId === account.id);
    if (!activity) return [];
    const kind = account.kind ?? "COST";
    const wrong = kind === "COST" ? activity.salesCount > 0 : activity.costCount > 0;
    if (!wrong) return [];
    const mixed = activity.salesCount > 0 && activity.costCount > 0;
    return [{
      id: account.id, code: account.code, name: account.name, kind, problem: kind === "COST" ? "SALES_ON_COST" as const : "COSTS_ON_INCOME" as const,
      salesCount: activity.salesCount, salesTotal: activity.salesTotal, costCount: activity.costCount, costTotal: activity.costTotal,
      suggestedKind: mixed ? null : kind === "COST" ? "INCOME" as const : "COST" as const,
    }];
  });
}

// --- Vendors ---------------------------------------------------------------------------------------------------

/** What a vendor still lacks of what it has to have (everything but the giro), as the API flags it. */
export function vendorMissingFields(vendor: StoredVendor): Vendor["incompleteFields"] & {} {
  const blank = (value: string | null) => !value?.trim();
  const missing: (Vendor["incompleteFields"] & {})[number][] = [];
  if (blank(vendor.name)) missing.push("name");
  if (blank(vendor.taxId)) missing.push("taxId");
  if (blank(vendor.legalName)) missing.push("legalName");
  if (blank(vendor.address)) missing.push("address");
  if (blank(vendor.region)) missing.push("region");
  if (blank(vendor.comuna)) missing.push("comuna");
  if (vendor.categoryIds.length === 0) missing.push("categories");
  if (vendor.creditDays === null) missing.push("creditDays");
  if (blank(vendor.defaultModality)) missing.push("defaultModality");
  if (blank(vendor.defaultDeliveryTerms)) missing.push("defaultDeliveryTerms");
  if (vendor.contacts.length === 0 || vendor.contacts.some(contact => blank(contact.phone) || blank(contact.email))) missing.push("contacts");
  if (vendor.paymentAccounts.length === 0) missing.push("paymentAccounts");
  return missing;
}

/** A stored vendor as GET /vendors/{id} answers it: categories with their names and what it lacks. */
export function vendorOf(state: ProcurementState, vendor: StoredVendor): Vendor {
  const { categoryIds, createdAt: _createdAt, ...rest } = vendor;
  return {
    ...rest, normalizedName: vendor.name.trim().toLowerCase(),
    categories: categoryIds.flatMap(id => state.vendorCategories.filter(category => category.id === id)).sort(byName),
    incompleteFields: vendorMissingFields(vendor),
  };
}

export type VendorFilter = { search?: string | undefined; includeInactive?: boolean | undefined; categoryIds?: string[] | undefined };
export type VendorListParams = VendorFilter & { page?: number | undefined; pageSize?: number | undefined };

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The vendors the filters leave in, A to Z: `search` is a plain substring of the name, legal name, RUT, category or giro. */
function filterVendors(state: ProcurementState, { search, includeInactive, categoryIds }: VendorFilter): Vendor[] {
  const term = fold(search?.trim() ?? "");
  const digits = term.replace(/[^0-9k]/g, "");
  return state.vendors
    .filter(vendor => includeInactive || vendor.active)
    .filter(vendor => !categoryIds?.length || vendor.categoryIds.some(id => categoryIds.includes(id)))
    .map(vendor => vendorOf(state, vendor))
    .filter(vendor => {
      if (!term) return true;
      const text = [vendor.name, vendor.legalName, vendor.businessActivity, ...(vendor.categories ?? []).map(category => category.name)].filter(Boolean).join(" ");
      return fold(text).includes(term) || (digits.length >= 3 && (vendor.taxId ?? "").replace(/[^0-9kK]/g, "").toLowerCase().includes(digits));
    })
    .sort(byName);
}

/** GET /vendors/catalog: one page of the vendors the filters leave in. */
export function listVendorCatalog(state: ProcurementState, params: VendorListParams = {}): VendorPage {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;
  const all = filterVendors(state, params);
  return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
}

/** Every vendor the filters leave in, unpaged: what GET /vendors/export writes. */
export const listVendorsForExport = (state: ProcurementState, filter: VendorFilter) => filterVendors(state, filter);

/** GET /vendors/categories: the company's pool, each with how many vendors have it. */
export const listVendorCategories = (state: ProcurementState): VendorCategory[] =>
  state.vendorCategories.map(category => ({ ...category, vendorCount: state.vendors.filter(vendor => vendor.categoryIds.includes(category.id)).length })).sort(byName);

export type VendorMetricsParams = { categoryIds?: string[] | undefined; includeInactive?: boolean | undefined; from?: string | undefined; to?: string | undefined };

const monthsBetween = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0));
};

/** GET /vendors/metrics: how much each vendor was ordered and paid in the period, and how its prices compare. */
export function vendorMetrics(state: ProcurementState, params: VendorMetricsParams = {}, today = new Date().toISOString().slice(0, 10)): VendorMetricsResult {
  const vendors = filterVendors(state, params);
  const metrics = vendors.map(vendor => {
    const stored = state.vendors.find(candidate => candidate.id === vendor.id)!;
    const all = state.vendorOrders.filter(order => order.vendorId === vendor.id).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
    const orders = all.filter(order => (!params.from || order.issueDate >= params.from) && (!params.to || order.issueDate <= params.to));
    const orderedAmount = orders.reduce((sum, order) => sum + order.netAmount, 0);
    const since = all[0] && all[0].issueDate < stored.createdAt ? all[0].issueDate : stored.createdAt;
    const price = state.vendorPrices.find(entry => entry.vendorId === vendor.id);
    return {
      id: vendor.id, name: vendor.name, taxId: vendor.taxId, active: vendor.active, categories: (vendor.categories ?? []).map(category => category.name),
      ordersCount: orders.length, orderedAmount, paidAmount: orders.filter(order => order.paid).reduce((sum, order) => sum + order.netAmount, 0),
      averageOrderAmount: orders.length ? Math.round(orderedAmount / orders.length) : 0,
      firstOrderDate: orders[0]?.issueDate ?? null, lastOrderDate: orders.at(-1)?.issueDate ?? null,
      since, seniorityMonths: monthsBetween(since, today), priceIndex: price?.index ?? null, comparedItems: price?.items ?? 0,
    };
  });
  const ordersCount = metrics.reduce((sum, metric) => sum + metric.ordersCount, 0);
  const orderedAmount = metrics.reduce((sum, metric) => sum + metric.orderedAmount, 0);
  return {
    totals: {
      vendors: metrics.length, vendorsWithOrders: metrics.filter(metric => metric.ordersCount > 0).length, ordersCount, orderedAmount,
      paidAmount: metrics.reduce((sum, metric) => sum + metric.paidAmount, 0), averageOrderAmount: ordersCount ? Math.round(orderedAmount / ordersCount) : 0,
    },
    vendors: metrics,
  };
}
