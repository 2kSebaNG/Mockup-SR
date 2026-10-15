import { z } from "zod";
import { CONTRACT_ADMIN, DEMO_USER, delegationByRules, findMember, requesters, type Person } from "./organization";

export const requestStatuses = ["Enviada", "En revisión", "Autorizado", "Rechazado", "Anulado"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

/**
 * Lifecycle: a request is sent (Enviada); the contract administrator either decides it directly
 * (Autorizado / Rechazado) or delegates it to a department (En revisión), whose reviewer then decides.
 */
export type MyRequest = {
  code: string;
  requester: Person;
  category: string;
  quantity: number;
  unit: string;
  description: string;
  /** True when the fields were filled by the AI from the written description. */
  aiAssisted: boolean;
  createdAt: string;
  dueDate: string;
  status: RequestStatus;
  /** Set once the request is delegated. */
  department: string | null;
  assignee: Person | null;
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

const statusWords: Record<RequestStatus, string> = { "Enviada": "enviada", "En revisión": "en revisión", "Autorizado": "autorizada", "Rechazado": "rechazada", "Anulado": "anulada" };

/** The status as it reads after "la solicitud está …" (statuses are stored in masculine, as in the reference designs). */
export function statusPhrase(status: RequestStatus) {
  return statusWords[status];
}

/** The contract administrator authorizes, rejects or delegates only requests nobody has handled yet. */
export function canDecide(status: RequestStatus) {
  return status === "Enviada";
}

/** Who the requester should talk to: the department reviewer once delegated, otherwise the contract administrator. */
export function responsibleFor(request: Pick<MyRequest, "assignee">): Person {
  return request.assignee ?? CONTRACT_ADMIN;
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica una fecha válida.").refine(value => !Number.isNaN(Date.parse(value)), "Indica una fecha válida.");
export const requestInputSchema = z.object({
  category: z.string().trim().min(1, "Selecciona el tipo de requerimiento.").max(80),
  quantity: z.number({ invalid_type_error: "Indica la cantidad." }).positive("La cantidad debe ser mayor a 0.").max(1_000_000),
  dueDate: isoDate,
  description: z.string().trim().max(4000),
  fields: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().max(100) })).max(16),
  aiAssisted: z.boolean().default(false),
});
export type RequestInput = z.infer<typeof requestInputSchema>;
export const requestCodeSchema = z.object({ code: z.string().regex(/^REQ-\d{4,}$/) });
export const requestUpdateSchema = requestCodeSchema.extend({ input: requestInputSchema });
export const requestDecisionSchema = requestCodeSchema.extend({ decision: z.enum(["Autorizado", "Rechazado"]) });
export const reviewerSchema = z.object({ department: z.string().max(80), assigneeName: z.string().max(120) })
  .refine(value => findMember(value.department, value.assigneeName), "Elige un encargado del departamento seleccionado.");
export const reviewerDecisionSchema = z.object({ reviewer: reviewerSchema, code: requestCodeSchema.shape.code, decision: z.enum(["Autorizado", "Rechazado"]) });
export const requestDelegationSchema = requestCodeSchema.extend({ department: z.string().max(80), assigneeName: z.string().max(120) })
  .refine(value => findMember(value.department, value.assigneeName), "Elige un encargado del departamento seleccionado.");

/** Turns validated form input into the stored request fields; unit comes from the "Unidad" field when present. */
export function requestFromInput(input: RequestInput) {
  const fields = input.fields.filter(field => field.value);
  const unit = fields.find(field => field.label.toLowerCase() === "unidad")?.value ?? "Unidades";
  return { category: input.category, quantity: input.quantity, unit, dueDate: input.dueDate, description: input.description, fields, aiAssisted: input.aiAssisted && input.description.length > 0 };
}

type Sample = Pick<MyRequest, "category" | "quantity" | "unit" | "description" | "fields" | "aiAssisted">;
const samples: Sample[] = [
  { category: "Herramientas", quantity: 4, unit: "Unidades", description: "", aiAssisted: false, fields: [{ label: "Marca", value: "Bosch" }, { label: "Alimentación", value: "Batería" }] },
  { category: "Maquinarias", quantity: 1, unit: "Días", description: "Necesito una grúa horquilla un día para descargar materiales en bodega.", aiAssisted: true, fields: [{ label: "Unidad", value: "Días" }, { label: "Capacidad", value: "5 toneladas" }, { label: "Alimentación", value: "Diésel" }] },
  { category: "Personas", quantity: 2, unit: "Unidades", description: "", aiAssisted: false, fields: [{ label: "Especialidad", value: "Soldador" }] },
  { category: "Materiales", quantity: 120, unit: "Metros", description: "Perfil de acero para refuerzo de plataforma.", aiAssisted: false, fields: [{ label: "Unidad", value: "Metros" }, { label: "Material", value: "Acero" }, { label: "Dimensiones", value: "Grande" }] },
  { category: "Alimentos", quantity: 60, unit: "Unidades", description: "", aiAssisted: false, fields: [{ label: "Formato", value: "Caja" }] },
  { category: "Bebestible", quantity: 50, unit: "Litros", description: "Agua purificada para la faena en zona de altura, en botellas.", aiAssisted: true, fields: [{ label: "Unidad", value: "Litros" }, { label: "Tipo de bebestible", value: "Agua" }, { label: "Formato", value: "Botella" }] },
  { category: "Materiales", quantity: 200, unit: "Pulgadas", description: "Quiero un tornillo de esos con surcos en cruz de un tamaño de 3/4.", aiAssisted: true, fields: [{ label: "Unidad", value: "Pulgadas" }, { label: "Material", value: "Acero" }, { label: "Tipo de tornillo", value: "Cabeza Phillips 3/4\"" }] },
];

/** Delegated requests carry their department; decided ones alternate between department and direct ADC decisions. */
function sampleAssignment(sample: Sample, status: RequestStatus, index: number): Pick<MyRequest, "department" | "assignee"> {
  const delegated = status === "En revisión" || ((status === "Autorizado" || status === "Rechazado") && index % 2 === 0);
  if (!delegated) return { department: null, assignee: null };
  const rule = delegationByRules(sample.category);
  return { department: rule.department, assignee: rule.assignee };
}

// Status mix matches the reference summary: 15 authorized, 5 in review, 2 rejected, 10 sent.
const statusPlan: RequestStatus[] = [
  ...Array<RequestStatus>(15).fill("Autorizado"),
  ...Array<RequestStatus>(5).fill("En revisión"),
  ...Array<RequestStatus>(2).fill("Rechazado"),
  ...Array<RequestStatus>(10).fill("Enviada"),
  ...Array<RequestStatus>(2).fill("Anulado"),
];
const dueOffsets = [-18, 21, 1, 9, 2, -1, 14, 30, 5, 0, 3, 12, -6, 17, 7, 25, 4, -3, 10, 2];

function buildSample(today: string, requester: Person, status: RequestStatus, index: number, code: number): MyRequest {
  const sample = samples[index % samples.length]!;
  const dueDate = addDays(today, dueOffsets[index % dueOffsets.length]! + (status === "Autorizado" ? -10 : 0));
  const created = addDays(dueDate, -14);
  return {
    ...sample,
    ...sampleAssignment(sample, status, index),
    code: `REQ-${String(code).padStart(4, "0")}`,
    requester,
    createdAt: created < today ? created : addDays(today, -1),
    dueDate,
    status,
  };
}

/** The demo user's sample requests; dates are relative to `today` so due warnings stay visible. */
export function sampleRequests(today: string): MyRequest[] {
  return statusPlan.map((status, index) => buildSample(today, DEMO_USER, status, index, 1201 + index * 7));
}

// Other requesters' work, so the contract administrator's queue has more than the demo user's requests.
const teamPlan: RequestStatus[] = ["Enviada", "Enviada", "Enviada", "Enviada", "Enviada", "Enviada", "Enviada", "Enviada", "En revisión", "En revisión", "En revisión", "Autorizado", "Autorizado", "Rechazado"];

/** Seed for development storage: the demo user's requests plus those of the rest of the team. */
export function seedRequests(today: string): MyRequest[] {
  const team = teamPlan.map((status, index) => buildSample(today, requesters[1 + (index % 2)]!, status, index + 3, 1440 + index * 3));
  return [...sampleRequests(today), ...team];
}
