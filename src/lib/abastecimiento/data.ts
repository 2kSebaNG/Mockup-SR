import { rutDv } from "@/lib/access";
import type { components } from "./api/schema";

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
export type ProjectStatus = Schemas["ProjectStatus"];
export type ProjectSummary = Schemas["ProjectSummary"];
export type ProjectListItem = Schemas["ProjectListItem"];
export type Person = Schemas["Person"];

/** A project as it is stored; the list item joins its deal, client and unit. */
export type Project = { id: string; code: string; name: string; status: ProjectStatus; startDate: string | null; endDate: string | null; dealId: string; businessUnitId: string | null };

export type ProcurementState = {
  businessUnits: BusinessUnit[];
  chartAccounts: ChartAccount[];
  taxRates: TaxRate[];
  company: Company;
  clients: Client[];
  deals: Deal[];
  projects: Project[];
  people: Person[];
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

  // The retention of honorarios goes up every January until 2028 (Ley 21.133).
  const taxRates: TaxRate[] = [
    { id: "tax-iva", kind: "IVA", validFrom: "2014-10-01", percent: 19 },
    { id: "tax-hon-2025", kind: "HONORARIOS_RETENTION", validFrom: "2025-01-01", percent: 14.5 },
    { id: "tax-hon-2026", kind: "HONORARIOS_RETENTION", validFrom: "2026-01-01", percent: 15.25 },
  ];

  const company: Company = {
    id: "company-1", name: "AECON", legalName: "AECON SpA", taxId: rut(76543210), address: "Av. Apoquindo 4501, oficina 1201, Las Condes",
    businessLine: "Ingeniería y construcción", website: "www.aecon.cl", contactEmails: "proveedores@aecon.cl - denuncias@aecon.cl", active: true,
    payrollChartAccountId: "ca-rem", alertVarianceAmount: 5_000_000, alertVariancePercent: 10, alertMinProfitability: 12,
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

  return { businessUnits, chartAccounts, taxRates, company, clients, deals, projects, people };
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

/** GET /deals: every deal, newest code first. */
export const listDeals = (state: ProcurementState) => [...state.deals].sort((a, b) => b.code.localeCompare(a.code));

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
