import { rutDv } from "@/lib/access";

// The sample vendors of the Abastecimiento module: the company's pool of categories, the vendors with their
// contacts and payment accounts (two of them saved before the data was required, so they show "Datos incompletos"),
// and a short history of approved and paid orders that feeds the vendor metrics until phase 2 brings the real
// purchase orders. Shapes as the API stores them; `data.ts` answers them as `Vendor`.

export type StoredVendorContact = { id: string; name: string; phone: string | null; email: string | null; role: string | null; position: number };
export type StoredVendorAccount = {
  id: string; recipientName: string | null; recipientTaxId: string | null; bankName: string | null; accountType: string | null;
  accountNumber: string | null; email: string | null; position: number;
};

/** A vendor as it is stored: its categories by id, the rest as GET /vendors/{id} answers it. */
export type StoredVendor = {
  id: string; name: string; taxId: string | null; active: boolean; legalName: string | null; businessActivity: string | null;
  creditDays: number | null; address: string | null; comuna: string | null; region: string | null; defaultModality: string | null;
  defaultDeliveryTerms: string | null; contacts: StoredVendorContact[]; paymentAccounts: StoredVendorAccount[]; categoryIds: string[];
  /** When it was registered (its seniority starts here when it has no order before). */
  createdAt: string;
};

export type StoredVendorCategory = { id: string; name: string };

/** An approved or paid order of a vendor, net: what the metrics add up. */
export type VendorOrderSample = { vendorId: string; issueDate: string; netAmount: number; paid: boolean };

/** How a vendor's prices compare with the others' on the same items (1 = the average). */
export type VendorPriceSample = { vendorId: string; index: number; items: number };

const rut = (body: number) => `${body}-${rutDv(body)}`;

export function seedVendors() {
  const categoryNames = [
    "Arriendo de maquinaria", "Materiales de construcción", "Elementos de protección personal", "Combustible", "Transporte",
    "Subcontratos eléctricos", "Alimentación", "Ferretería", "Servicios de ingeniería",
  ];
  const vendorCategories: StoredVendorCategory[] = categoryNames.map((name, index) => ({ id: `vc-${index + 1}`, name }));
  const cat = (name: string) => vendorCategories.find(category => category.name === name)!.id;

  type Seed = {
    name: string; body: number; legalName: string | null; activity?: string; categories: string[]; credit: number | null;
    region: string | null; comuna: string | null; address: string | null; modality: string | null; delivery: string | null;
    contact?: [string, string, string, string?][]; account?: [string, string, string, string, string?]; active?: boolean; createdAt: string;
  };
  const seeds: Seed[] = [
    { name: "Arriendos Andes", body: 76412308, legalName: "Arriendos Andes SpA", activity: "Arriendo de maquinaria y equipo", categories: ["Arriendo de maquinaria"], credit: 30,
      region: "Antofagasta", comuna: "Calama", address: "Av. Granaderos 2450", modality: "Factura", delivery: "Inmediata",
      contact: [["Rodrigo Muñoz", "+56 9 8123 4567", "rmunoz@arriendosandes.cl", "Ventas"], ["Paola Díaz", "+56 9 7765 1122", "cobranza@arriendosandes.cl", "Cobranza"]],
      account: ["Banco de Chile", "Corriente", "00-123-45678-09", "pagos@arriendosandes.cl"], createdAt: "2024-03-11" },
    { name: "Ferretería Industrial Norte", body: 77890123, legalName: "Ferretería Industrial Norte Ltda.", activity: "Venta al por mayor de artículos de ferretería", categories: ["Ferretería", "Materiales de construcción"], credit: 30,
      region: "Antofagasta", comuna: "Antofagasta", address: "Av. Argentina 1890", modality: "Factura", delivery: "Inmediata",
      contact: [["Claudia Rojas", "+56 9 6543 2190", "ventas@finorte.cl"]], account: ["Banco Santander", "Corriente", "7123456-8", "finanzas@finorte.cl"], createdAt: "2023-08-02" },
    { name: "Seguridad Total", body: 76234567, legalName: "Seguridad Total Chile SpA", activity: "Venta de elementos de protección personal", categories: ["Elementos de protección personal"], credit: 60,
      region: "Metropolitana de Santiago", comuna: "Quilicura", address: "Av. Américo Vespucio 1501", modality: "Factura", delivery: "Pago Final Contra Entrega",
      contact: [["Marco Aravena", "+56 2 2987 6543", "maravena@seguridadtotal.cl", "Ejecutivo de cuentas"]], account: ["Banco BCI", "Corriente", "61234567", "tesoreria@seguridadtotal.cl"], createdAt: "2022-11-20" },
    { name: "Combustibles del Pacífico", body: 96543210, legalName: "Combustibles del Pacífico S.A.", activity: "Venta al por menor de combustibles", categories: ["Combustible"], credit: 0,
      region: "Biobío", comuna: "Concepción", address: "Av. Paicaví 3200", modality: "Factura", delivery: "Inmediata",
      contact: [["Mesa de clientes", "+56 41 223 4455", "clientes@copacifico.cl"]], account: ["Banco Estado", "Corriente", "29876543", "recaudacion@copacifico.cl"], createdAt: "2021-05-04" },
    { name: "Transportes Cordillera", body: 78123456, legalName: "Transportes Cordillera Ltda.", activity: "Transporte de carga por carretera", categories: ["Transporte"], credit: 30,
      region: "Metropolitana de Santiago", comuna: "Pudahuel", address: "Camino Lo Boza 120", modality: "Factura", delivery: "Inmediata",
      contact: [["Hernán Saavedra", "+56 9 9234 1100", "hsaavedra@tcordillera.cl", "Operaciones"]], account: ["Scotiabank", "Corriente", "970012345", "pagos@tcordillera.cl"], createdAt: "2024-01-15" },
    { name: "Eléctrica Sur", body: 76987654, legalName: "Eléctrica Sur SpA", activity: "Instalaciones eléctricas", categories: ["Subcontratos eléctricos"], credit: 30,
      region: "La Araucanía", comuna: "Temuco", address: "Av. Alemania 0845", modality: "Factura", delivery: "Pago Final Contra Entrega",
      contact: [["Valentina Huenchullán", "+56 9 8812 3344", "vhuenchullan@electricasur.cl", "Jefa de proyectos"]], account: ["Banco Itaú", "Corriente", "0212345678", "contabilidad@electricasur.cl"], createdAt: "2025-09-01" },
    { name: "Casino Minero", body: 77456789, legalName: "Servicios de Alimentación Casino Minero SpA", activity: "Suministro de comidas por encargo", categories: ["Alimentación"], credit: 30,
      region: "Antofagasta", comuna: "Calama", address: "Balmaceda 3241", modality: "Factura", delivery: "Inmediata",
      contact: [["Andrea Ponce", "+56 9 7001 2233", "aponce@casinominero.cl"]], account: ["Banco BCI", "Vista", "777012345678", "pagos@casinominero.cl"], createdAt: "2025-02-17" },
    { name: "Ingeniería Vértice", body: 76345678, legalName: "Ingeniería Vértice Consultores SpA", activity: "Servicios de ingeniería", categories: ["Servicios de ingeniería"], credit: 60,
      region: "Metropolitana de Santiago", comuna: "Las Condes", address: "Av. Apoquindo 3600, piso 9", modality: "Factura", delivery: "Pago Final Contra Entrega",
      contact: [["Francisco Lagos", "+56 2 2456 7788", "flagos@vertice.cl", "Socio"]], account: ["Banco Security", "Corriente", "9012345", "administracion@vertice.cl"], createdAt: "2023-04-28" },
    { name: "Hormigones Maipo", body: 96789012, legalName: "Hormigones Maipo S.A.", activity: "Fabricación de hormigón", categories: ["Materiales de construcción"], credit: 30,
      region: "Metropolitana de Santiago", comuna: "San Bernardo", address: "Av. Lo Herrera 1100", modality: "Factura", delivery: "Inmediata",
      contact: [["Despacho", "+56 2 2859 1000", "despacho@hmaipo.cl"]], account: ["Banco de Chile", "Corriente", "00-801-12345-06", "cobranza@hmaipo.cl"], createdAt: "2022-06-09" },
    { name: "Grúas Magallanes", body: 76111222, legalName: "Grúas y Montajes Magallanes Ltda.", activity: "Arriendo de grúas con operador", categories: ["Arriendo de maquinaria", "Transporte"], credit: 30,
      region: "Magallanes y de la Antártica Chilena", comuna: "Punta Arenas", address: "Av. Costanera del Estrecho 980", modality: "Factura", delivery: "Inmediata",
      contact: [["Iván Vidal", "+56 9 6612 7788", "ividal@gruasmagallanes.cl"]], account: ["Banco Santander", "Corriente", "6512345-1", "pagos@gruasmagallanes.cl"], active: false, createdAt: "2024-08-20" },
    { name: "Juan Pérez Topografía", body: 13579246, legalName: "Juan Andrés Pérez Soto", activity: "Servicios de topografía", categories: ["Servicios de ingeniería"], credit: 0,
      region: "Valparaíso", comuna: "Viña del Mar", address: "Av. Libertad 1348, of. 52", modality: "Boleta de honorarios", delivery: "Pago Final Contra Entrega",
      contact: [["Juan Pérez", "+56 9 9988 7766", "jperez.topografia@gmail.com"]], account: ["Banco Estado", "RUT", "13579246", "jperez.topografia@gmail.com"], createdAt: "2025-11-10" },
    { name: "EPP Express", body: 77666555, legalName: "EPP Express SpA", activity: "Venta de elementos de protección personal", categories: ["Elementos de protección personal", "Ferretería"], credit: 30,
      region: "Metropolitana de Santiago", comuna: "Santiago", address: "San Diego 1520", modality: "Factura", delivery: "Inmediata",
      contact: [["Ventas", "+56 2 2555 4433", "ventas@eppexpress.cl"]], account: ["Banco Falabella", "Corriente", "1-234-567890-1", "pagos@eppexpress.cl"], createdAt: "2026-02-03" },
    // Saved before every field was required: they show what is missing.
    { name: "Fletes Rápidos", body: 76555444, legalName: null, categories: ["Transporte"], credit: null, region: null, comuna: null, address: null,
      modality: null, delivery: null, contact: [["Pedro Fuentes", "+56 9 5544 3322", ""]], createdAt: "2020-09-14" },
    { name: "Comercial Los Robles", body: 77222333, legalName: "Comercial Los Robles Ltda.", categories: [], credit: 30, region: "Maule", comuna: "Talca",
      address: "1 Sur 1120", modality: "Factura", delivery: null, createdAt: "2021-01-22" },
  ];

  const vendors: StoredVendor[] = seeds.map((seed, index) => {
    const id = `ven-${index + 1}`;
    const taxId = rut(seed.body);
    return {
      id, name: seed.name, taxId, active: seed.active ?? true, legalName: seed.legalName, businessActivity: seed.activity ?? null,
      creditDays: seed.credit, address: seed.address, comuna: seed.comuna, region: seed.region, defaultModality: seed.modality,
      defaultDeliveryTerms: seed.delivery, categoryIds: seed.categories.map(cat), createdAt: seed.createdAt,
      contacts: (seed.contact ?? []).map(([name, phone, email, role], position) => ({ id: `${id}-c${position + 1}`, name, phone, email: email || null, role: role ?? null, position })),
      paymentAccounts: seed.account
        ? [{ id: `${id}-a1`, recipientName: seed.legalName ?? seed.name, recipientTaxId: taxId, bankName: seed.account[0], accountType: seed.account[1], accountNumber: seed.account[2], email: seed.account[3], position: 0 }]
        : [],
    };
  });

  // [vendor, issue date, net amount, paid]
  const orders: [number, string, number, boolean][] = [
    [1, "2026-03-20", 18_400_000, true], [1, "2026-05-04", 22_100_000, true], [1, "2026-07-15", 19_800_000, true], [1, "2026-09-30", 21_500_000, false],
    [2, "2025-11-12", 3_250_000, true], [2, "2026-01-08", 2_980_000, true], [2, "2026-04-22", 4_120_000, true], [2, "2026-06-03", 1_870_000, true], [2, "2026-08-19", 3_640_000, false],
    [3, "2026-02-14", 6_480_000, true], [3, "2026-06-25", 5_920_000, true],
    [4, "2025-12-01", 9_850_000, true], [4, "2026-02-02", 10_420_000, true], [4, "2026-04-01", 11_030_000, true], [4, "2026-06-01", 10_880_000, true], [4, "2026-08-03", 11_250_000, true], [4, "2026-10-01", 11_600_000, false],
    [5, "2026-03-28", 4_300_000, true], [5, "2026-07-07", 3_900_000, true],
    [6, "2026-09-15", 48_600_000, false],
    [7, "2026-04-30", 7_200_000, true], [7, "2026-05-31", 7_350_000, true], [7, "2026-06-30", 7_410_000, true], [7, "2026-07-31", 7_520_000, true], [7, "2026-08-31", 7_640_000, false],
    [8, "2026-05-20", 26_000_000, true], [8, "2026-08-11", 14_500_000, true],
    [9, "2026-06-10", 38_700_000, true], [9, "2026-09-02", 41_200_000, true],
    [10, "2024-10-15", 12_800_000, true], [10, "2025-03-03", 9_400_000, true],
    [11, "2026-01-20", 1_450_000, true], [11, "2026-05-18", 1_650_000, true],
    [12, "2026-03-09", 2_100_000, true], [12, "2026-08-27", 2_480_000, true],
  ];
  const vendorOrders: VendorOrderSample[] = orders.map(([vendor, issueDate, netAmount, paid]) => ({ vendorId: `ven-${vendor}`, issueDate, netAmount, paid }));

  const prices: [number, number, number][] = [[2, 1.08, 14], [12, 0.91, 9], [3, 1.03, 6], [9, 0.96, 3], [1, 1.12, 2], [5, 0.94, 2]];
  const vendorPrices: VendorPriceSample[] = prices.map(([vendor, index, items]) => ({ vendorId: `ven-${vendor}`, index, items }));

  return { vendorCategories, vendors, vendorOrders, vendorPrices };
}
