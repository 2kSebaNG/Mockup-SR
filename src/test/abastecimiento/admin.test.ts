import { rutDv } from "@/lib/access";
import { comunasOf } from "@/lib/abastecimiento/territory";
import {
  ApiFailure, createBusinessUnit, createChartAccount, createClient, createTaxRate, createVendor, createVendorCategory, deleteTaxRate, deleteVendorCategory,
  renameVendorCategory, suggestClientSigla, updateChartAccount, updateClient, updateCompany, updateTaxRate, updateVendor,
} from "@/lib/abastecimiento/admin";
import { apiErrorText } from "@/lib/abastecimiento/api-error";
import { listChartAccounts, listKindConflicts, listVendorCatalog, listVendorCategories, seedProcurement, vendorMetrics, type ProcurementState } from "@/lib/abastecimiento/data";
import { vendorsCsv } from "@/lib/abastecimiento/vendor-export";

const state = seedProcurement();
const codes = (next: ProcurementState) => Object.fromEntries(listChartAccounts(next).map(account => [account.name, account.code]));
/** What the screen reads when a write is refused. */
const refusal = (write: () => unknown) => {
  try { write(); } catch (error) { expect(error).toBeInstanceOf(ApiFailure); return apiErrorText(error, "fallback"); }
  throw new Error("expected a refusal");
};

describe("Abastecimiento · business units", () => {
  it("creates a unit and refuses a repeated name, whatever its case", () => {
    const { state: next, data } = createBusinessUnit(state, { name: " Logística ", description: "" });
    expect(data).toMatchObject({ name: "Logística", description: null, active: true });
    expect(refusal(() => createBusinessUnit(next, { name: "logística" }))).toBe("Ya existe una unidad de negocio con ese nombre.");
  });
});

describe("Abastecimiento · chart of accounts", () => {
  it("numbers a new account after its siblings, under its parent's code, with its parent's kind", () => {
    const root = createChartAccount(state, { name: "Gastos generales" });
    expect(root.data).toMatchObject({ code: "6", parentAccountId: null, kind: "COST" });
    const child = createChartAccount(state, { name: "Intereses", parentAccountId: "ca-ing" });
    expect(child.data).toMatchObject({ code: "4.3", kind: "INCOME" });
  });

  it("reorders siblings with the same numbers", () => {
    // «Caja Chica» (5.5) goes first among the costs: everything before it moves down one, its children follow it.
    const { state: next } = updateChartAccount(state, "ca-cch", { parentAccountId: "ca-cos", position: 0 });
    expect(codes(next)).toMatchObject({ "Caja Chica": "5.1", "Alimentación": "5.1.1", "Remuneraciones": "5.2", "Subcontratos": "5.5", "Elementos de protección personal": "5.6" });
  });

  it("moves an account under another one, closing the gap it leaves", () => {
    const { state: next, data } = updateChartAccount(state, "ca-mat", { parentAccountId: "ca-sub" });
    expect(data).toMatchObject({ code: "5.3.1", parentAccountId: "ca-sub" });
    expect(codes(next)).toMatchObject({ "Remuneraciones": "5.1", "Arriendo - Equipos y Vehículos": "5.2", "Subcontratos": "5.3", "Caja Chica": "5.4", "Combustible": "5.4.2" });
    expect(new Set(next.chartAccounts.map(account => account.code)).size).toBe(next.chartAccounts.length);
  });

  it("refuses to put an account inside itself", () => {
    expect(refusal(() => updateChartAccount(state, "ca-cos", { parentAccountId: "ca-cch-ali" }))).toBe("Una cuenta no puede quedar dentro de sí misma ni de sus subcuentas.");
  });

  it("flags the accounts whose kind does not match what is booked to them", () => {
    const conflicts = listKindConflicts(state);
    expect(conflicts.map(conflict => [conflict.name, conflict.problem, conflict.suggestedKind])).toEqual([
      ["Otros ingresos", "COSTS_ON_INCOME", "COST"],
      ["Subcontratos", "SALES_ON_COST", null],
    ]);
    const fixed = updateChartAccount(state, "ca-ing-otros", { kind: "COST" }).state;
    expect(listKindConflicts(fixed)).toHaveLength(1);
  });
});

describe("Abastecimiento · tax rates", () => {
  it("adds a readjustment and refuses a second rate on the same day or before the first", () => {
    const { state: next } = createTaxRate(state, { kind: "HONORARIOS_RETENTION", validFrom: "2027-01-01", percent: 16 });
    expect(next.taxRates).toHaveLength(state.taxRates.length + 1);
    expect(refusal(() => createTaxRate(next, { kind: "HONORARIOS_RETENTION", validFrom: "2027-01-01", percent: 16 }))).toBe("Ese impuesto ya tiene una tasa que rige desde ese día.");
    expect(refusal(() => createTaxRate(state, { kind: "IVA", validFrom: "2010-01-01", percent: 18 }))).toBe("Una tasa no puede regir antes que la primera de su impuesto.");
  });

  it("keeps the first rate's date and never removes it", () => {
    expect(refusal(() => updateTaxRate(state, "tax-iva", { validFrom: "2015-01-01" }))).toBe("La primera tasa mantiene su fecha: cubre los días anteriores.");
    expect(updateTaxRate(state, "tax-iva", { percent: 19.5 }).data.percent).toBe(19.5);
    expect(refusal(() => deleteTaxRate(state, "tax-hon-2025"))).toBe("La primera tasa de un impuesto no se puede quitar.");
    expect(deleteTaxRate(state, "tax-hon-2026").state.taxRates).toHaveLength(state.taxRates.length - 1);
  });
});

describe("Abastecimiento · company", () => {
  it("stores the RUT without dots and refuses an invalid one", () => {
    expect(updateCompany(state, { taxId: "76.543.210-3", alertVariancePercent: null }).data).toMatchObject({ taxId: "76543210-3", alertVariancePercent: null });
    expect(refusal(() => updateCompany(state, { taxId: "76.543.210-4" }))).toBe("El RUT no es válido. Revisa el dígito verificador.");
  });
});

describe("Abastecimiento · clients", () => {
  it("suggests a sigla from the name's initials, numbered when taken", () => {
    expect(suggestClientSigla(state, "Constructora del Valle Central")).toBe("CVC");
    expect(suggestClientSigla(state, "Minera Los Andes")).toBe("MLA2");
    expect(suggestClientSigla(state, "Puerto Ventanas")).toBe("PVE");
    expect(suggestClientSigla(state, "Codelco")).toBe("COD");
    expect(suggestClientSigla(state, "Metalúrgica Lautaro Austral")).toBe("MLA2");
  });

  it("creates a client with a suggested sigla and refuses a repeated RUT or sigla", () => {
    const { data } = createClient(state, { name: "Puerto Ventanas" });
    expect(data.sigla).toBe("PVE");
    expect(refusal(() => createClient(state, { name: "Otro", taxId: state.clients[0]!.taxId! }))).toBe("Ya existe un cliente con ese RUT.");
    expect(refusal(() => updateClient(state, "cl-2", { sigla: "mla" }))).toBe("Esa sigla ya la usa otro cliente.");
    expect(updateClient(state, "cl-2", { taxId: "" }).data.taxId).toBeNull();
  });
});

describe("Abastecimiento · vendors", () => {
  const rut = `76300200-${rutDv(76300200)}`;
  const body = {
    name: "Andamios Sur", taxId: `76.300.200-${rutDv(76300200)}`, legalName: "Andamios Sur SpA", creditDays: 30, address: "Av. Colón 1200", region: "Biobío", comuna: "Talcahuano",
    defaultModality: "Factura" as const, defaultDeliveryTerms: "Inmediata" as const, categories: ["andamios", "Ferretería"],
    contacts: [{ name: "Luis Soto", phone: "+56 9 1111 2222", email: "lsoto@andamiossur.cl" }],
    paymentAccounts: [{ recipientName: "Andamios Sur SpA", recipientTaxId: rut, bankName: "Banco BCI" as const, accountType: "Corriente", accountNumber: "123", email: "pagos@andamiossur.cl" }],
  };

  it("has sample vendors in real comunas of their region", () => {
    expect(state.vendors.filter(vendor => vendor.region).every(vendor => comunasOf(vendor.region!).includes(vendor.comuna!))).toBe(true);
  });

  it("pages the catalog A to Z and filters by text, RUT and category", () => {
    const first = listVendorCatalog(state, { page: 1, pageSize: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.total).toBe(state.vendors.filter(vendor => vendor.active).length);
    expect(first.items.map(vendor => vendor.name)).toEqual([...first.items.map(vendor => vendor.name)].sort((a, b) => a.localeCompare(b, "es")));
    expect(listVendorCatalog(state, { search: "proteccion" }).items.map(vendor => vendor.name)).toEqual(["EPP Express", "Seguridad Total"]);
    expect(listVendorCatalog(state, { search: "76.412" }).items.map(vendor => vendor.name)).toEqual(["Arriendos Andes"]);
    expect(listVendorCatalog(state, { categoryIds: ["vc-1"], includeInactive: true }).total).toBe(2);
  });

  it("flags what a vendor saved before the rules still lacks", () => {
    const legacy = listVendorCatalog(state, { search: "Fletes" }).items[0]!;
    expect(legacy.incompleteFields).toEqual(expect.arrayContaining(["legalName", "address", "creditDays", "contacts", "paymentAccounts"]));
  });

  it("creates a vendor, adding new categories to the pool and reusing the ones it has", () => {
    const { state: next, data } = createVendor(state, body);
    expect(data).toMatchObject({ taxId: rut, incompleteFields: [] });
    expect(data.categories!.map(category => category.name)).toEqual(["andamios", "Ferretería"]);
    expect(next.vendorCategories).toHaveLength(state.vendorCategories.length + 1);
    expect(refusal(() => createVendor(next, { ...body, name: "Otro" }))).toBe("Ya existe un proveedor con ese RUT.");
  });

  it("updates and deactivates a vendor", () => {
    const { data } = updateVendor(state, "ven-1", { active: false, creditDays: 60 });
    expect(data).toMatchObject({ active: false, creditDays: 60, name: "Arriendos Andes" });
  });

  it("keeps the pool of categories without repeats and removes only unused ones", () => {
    expect(createVendorCategory(state, "combustible").state.vendorCategories).toHaveLength(state.vendorCategories.length);
    expect(refusal(() => renameVendorCategory(state, "vc-4", "transporte"))).toBe('Ya existe una categoría llamada "transporte".');
    expect(refusal(() => deleteVendorCategory(state, "vc-4"))).toBe("La usan 1 proveedor: quítala de ellos primero.");
    const unused = createVendorCategory(state, "Topografía");
    expect(listVendorCategories(deleteVendorCategory(unused.state, unused.data.id).state)).toHaveLength(state.vendorCategories.length);
  });

  it("adds up the orders of each vendor in the period", () => {
    const all = vendorMetrics(state, {}, "2026-11-02");
    const fuel = all.vendors.find(metric => metric.name === "Combustibles del Pacífico")!;
    expect(fuel).toMatchObject({ ordersCount: 6, paidAmount: 53_430_000, since: "2021-05-04" });
    const thisYear = vendorMetrics(state, { from: "2026-01-01", to: "2026-11-02" }, "2026-11-02");
    expect(thisYear.vendors.find(metric => metric.name === "Combustibles del Pacífico")!.ordersCount).toBe(5);
    expect(thisYear.totals.ordersCount).toBe(thisYear.vendors.reduce((sum, metric) => sum + metric.ordersCount, 0));
  });

  it("writes the export as a CSV Excel opens", () => {
    const vendors = listVendorCatalog(state, { search: "Andes" }).items;
    const csv = vendorsCsv(vendors, vendorMetrics(state).vendors);
    const [header, row] = csv.slice(1).split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(header!.split(";")[0]).toBe("Nombre");
    expect(row).toContain("Arriendos Andes;76412308-");
  });
});
