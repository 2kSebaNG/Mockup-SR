import { z } from "zod";

export const requestStatuses = ["Enviada", "En revisión", "Autorizado", "Rechazado", "Anulado"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export type Authorizer = { name: string; role: string };
export type MyRequest = {
  code: string;
  category: string;
  quantity: number;
  unit: string;
  description: string;
  createdAt: string;
  dueDate: string;
  status: RequestStatus;
  authorizer: Authorizer;
  fields: { label: string; value: string }[];
};

export type RequestFilters = { query: string; statuses: RequestStatus[]; categories: string[]; from: string; to: string };
export type SortDirection = "asc" | "desc";
export type DueState = "overdue" | "soon" | null;

export const DUE_SOON_DAYS = 3;
export const emptyFilters: RequestFilters = { query: "", statuses: [], categories: [], from: "", to: "" };

const pending: RequestStatus[] = ["Enviada", "En revisión"];

export function canEdit(status: RequestStatus) {
  return pending.includes(status);
}

export function canCancel(status: RequestStatus) {
  return status !== "Anulado";
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Only requests still waiting on a decision can expire. */
export function dueState(request: Pick<MyRequest, "status" | "dueDate">, today: string): DueState {
  if (!pending.includes(request.status)) return null;
  const left = daysBetween(today, request.dueDate);
  if (left < 0) return "overdue";
  return left <= DUE_SOON_DAYS ? "soon" : null;
}

export function countByStatus(requests: MyRequest[]) {
  const counts = Object.fromEntries(requestStatuses.map(status => [status, 0])) as Record<RequestStatus, number>;
  for (const request of requests) counts[request.status]++;
  return counts;
}

export function filterRequests(requests: MyRequest[], filters: RequestFilters) {
  const query = filters.query.trim().toLowerCase();
  return requests.filter(request =>
    (!query || request.code.toLowerCase().includes(query)) &&
    (!filters.statuses.length || filters.statuses.includes(request.status)) &&
    (!filters.categories.length || filters.categories.includes(request.category)) &&
    (!filters.from || request.dueDate >= filters.from) &&
    (!filters.to || request.dueDate <= filters.to));
}

export function sortByDueDate(requests: MyRequest[], direction: SortDirection) {
  const sign = direction === "asc" ? 1 : -1;
  return [...requests].sort((a, b) => sign * a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, start, end: Math.min(start + pageSize, items.length) };
}

// No sign-in exists yet, so every request belongs to the demo account shown in the header.
export const DEMO_REQUESTER = "snunez@aecon.cl";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica una fecha válida.").refine(value => !Number.isNaN(Date.parse(value)), "Indica una fecha válida.");
export const requestInputSchema = z.object({
  category: z.string().trim().min(1, "Selecciona el tipo de requerimiento.").max(80),
  quantity: z.number({ invalid_type_error: "Indica la cantidad." }).positive("La cantidad debe ser mayor a 0.").max(1_000_000),
  dueDate: isoDate,
  description: z.string().trim().max(4000),
  fields: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().max(100) })).max(16),
});
export type RequestInput = z.infer<typeof requestInputSchema>;
export const requestCodeSchema = z.object({ code: z.string().regex(/^REQ-\d{4,}$/) });
export const requestUpdateSchema = requestCodeSchema.extend({ input: requestInputSchema });

const authorizers: Authorizer[] = [
  { name: "Maridel Rojas", role: "Jefa de Abastecimiento" },
  { name: "Carlos Fuentes", role: "Administrador de Contrato" },
  { name: "Vladimir Soto", role: "Jefe de Bodega" },
  { name: "Paula Araya", role: "Jefa de Personas" },
];
const authorizerByCategory: Record<string, Authorizer> = {
  Maquinarias: authorizers[1]!,
  Herramientas: authorizers[2]!,
  Materiales: authorizers[2]!,
  Personas: authorizers[3]!,
};

/** Who approves a category; anything without a specific owner goes to procurement. */
export function authorizerFor(category: string): Authorizer {
  return authorizerByCategory[category] ?? authorizers[0]!;
}

/** Turns validated form input into the stored request fields; unit comes from the "Unidad" field when present. */
export function requestFromInput(input: RequestInput) {
  const fields = input.fields.filter(field => field.value);
  const unit = fields.find(field => field.label.toLowerCase() === "unidad")?.value ?? "Unidades";
  return { category: input.category, quantity: input.quantity, unit, dueDate: input.dueDate, description: input.description, fields, authorizer: authorizerFor(input.category) };
}

const samples: Omit<MyRequest, "code" | "createdAt" | "dueDate" | "status" | "authorizer">[] = [
  { category: "Herramientas", quantity: 4, unit: "Unidades", description: "Taladros percutores para mantención de estructuras.", fields: [{ label: "Marca", value: "Bosch" }, { label: "Alimentación", value: "Batería" }] },
  { category: "Maquinarias", quantity: 1, unit: "Días", description: "Grúa horquilla para descarga de materiales en bodega.", fields: [{ label: "Capacidad", value: "5 toneladas" }, { label: "Alimentación", value: "Diésel" }] },
  { category: "Personas", quantity: 2, unit: "Unidades", description: "Soldadores para turno de noche durante dos semanas.", fields: [{ label: "Especialidad", value: "Soldador" }] },
  { category: "Materiales", quantity: 120, unit: "Metros", description: "Perfil de acero para refuerzo de plataforma.", fields: [{ label: "Material", value: "Acero" }, { label: "Dimensiones", value: "Grande" }] },
  { category: "Alimentos", quantity: 60, unit: "Unidades", description: "Colaciones para cuadrilla de terreno.", fields: [{ label: "Formato", value: "Caja" }] },
  { category: "Bebestible", quantity: 50, unit: "Litros", description: "Agua purificada para faena en zona de altura.", fields: [{ label: "Tipo de bebestible", value: "Agua" }, { label: "Formato", value: "Botella" }] },
];

// Status mix matches the reference summary: 15 authorized, 5 in review, 2 rejected, 10 sent.
const statusPlan: RequestStatus[] = [
  ...Array<RequestStatus>(15).fill("Autorizado"),
  ...Array<RequestStatus>(5).fill("En revisión"),
  ...Array<RequestStatus>(2).fill("Rechazado"),
  ...Array<RequestStatus>(10).fill("Enviada"),
  ...Array<RequestStatus>(2).fill("Anulado"),
];
const dueOffsets = [-18, 21, 1, 9, 2, -1, 14, 30, 5, 0, 3, 12, -6, 17, 7, 25, 4, -3, 10, 2];

/** Sample data until requests are persisted; dates are relative to `today` so due warnings stay visible. */
export function sampleRequests(today: string): MyRequest[] {
  return statusPlan.map((status, index) => {
    const sample = samples[index % samples.length]!;
    const dueDate = addDays(today, dueOffsets[index % dueOffsets.length]! + (status === "Autorizado" ? -10 : 0));
    const created = addDays(dueDate, -14);
    return {
      ...sample,
      code: `REQ-${String(1201 + index * 7).padStart(4, "0")}`,
      createdAt: created < today ? created : addDays(today, -1),
      dueDate,
      status,
      authorizer: authorizers[index % authorizers.length]!,
    };
  });
}
