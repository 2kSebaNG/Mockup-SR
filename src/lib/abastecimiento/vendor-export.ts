import type { Vendor } from "./data";
import { creditShort, mainAccount, mainContact, missingLabels } from "./vendors";
import type { VendorMetric } from "./vendor-metrics";

// The vendor list as a file, until GET /vendors/export (an .xlsx) answers it: a CSV with semicolons and a BOM, as
// Excel in Spanish opens it without asking. One row per vendor, with its main contact, its main account and its
// figures.

/** Excel reads the accents right only when the file starts with a byte order mark. */
const BOM = String.fromCharCode(0xfeff);

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function vendorsCsv(vendors: Vendor[], metrics: VendorMetric[]): string {
  const header = [
    "Nombre", "RUT", "Razón social", "Giro", "Categorías", "Condición de pago", "Modalidad", "Entrega", "Región", "Comuna", "Dirección",
    "Contacto principal", "Teléfono", "Correo", "Banco", "Tipo de cuenta", "N° de cuenta", "Estado", "Datos que faltan",
    "OCs realizadas", "Monto ordenado", "Monto pagado",
  ];
  const rows = vendors.map(vendor => {
    const contact = mainContact(vendor);
    const account = mainAccount(vendor);
    const metric = metrics.find(candidate => candidate.id === vendor.id);
    return [
      vendor.name, vendor.taxId, vendor.legalName, vendor.businessActivity, (vendor.categories ?? []).map(category => category.name).join(", "),
      creditShort(vendor.creditDays), vendor.defaultModality, vendor.defaultDeliveryTerms, vendor.region, vendor.comuna, vendor.address,
      contact?.name, contact?.phone, contact?.email, account?.bankName, account?.accountType, account?.accountNumber,
      vendor.active ? "Activo" : "Inactivo", missingLabels(vendor).join(", "), metric?.ordersCount ?? 0, metric?.orderedAmount ?? 0, metric?.paidAmount ?? 0,
    ];
  });
  return `${BOM}${[header, ...rows].map(row => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
