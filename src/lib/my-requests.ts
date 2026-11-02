import { z } from "zod";
import { CONTRACT_ADMIN, DEMO_USER, delegationByRules, findMember, requesters, type Person } from "./organization";
import { defaultCatalog, elementLabelFor, proposalFor, type ProposalReview, type StoredProposal } from "./catalog";
import { defaultElements, normalizeForSearch } from "./elements";

export const requestStatuses = ["Enviada", "En revisión", "En gestión", "Completada", "Rechazado", "Anulado"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

/**
 * Lifecycle: a request is sent (Enviada) and moves to En revisión when the contract administrator starts reviewing it.
 * The administrator either decides it directly (Completada / Rechazado) or delegates it to a department (En gestión),
 * whose reviewer then decides.
 */
export type MyRequest = {
  code: string;
  requester: Person;
  category: string;
  /** The element type asked for (e.g. "Soldador"), under the category's element label (e.g. "Cargo"). */
  element: string;
  elementLabel: string;
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
  /** New types, attributes or options this request proposes for the catalog, pending the administrator's decision. */
  proposal: StoredProposal | null;
  /** Why it was rejected; required to reject. */
  rejectionReason: string | null;
  /** When the administrator or the reviewing department expects to resolve it. */
  estimatedResolution: string | null;
  /** Set when the request was sent together with others as one package (e.g. REQ-1501 for REQ-1501-2). */
  parentCode: string | null;
  /** Day the contract administrator started reviewing it (Enviada → En revisión). */
  reviewStartedAt: string | null;
  /** Day it was delegated to a department (→ En gestión). */
  delegatedAt: string | null;
  /** Day it was completed, rejected or cancelled. */
  resolvedAt: string | null;
};

/** A request as the server returns it: with its proposal compared against the current catalog. */
export type ReviewedRequest = MyRequest & { review: ProposalReview | null };

/** Which date the range filter reads. */
export const dateFields = ["createdAt", "dueDate", "resolvedAt"] as const;
export type DateField = (typeof dateFields)[number];
/**
 * `dateField` null means "the view's default": the table filters by due date, the dashboard reads the range as a
 * period of creation. Choosing one explicitly applies it to both views.
 */
export type RequestFilters = { query: string; statuses: RequestStatus[]; categories: string[]; from: string; to: string; dateField: DateField | null };
export type SortDirection = "asc" | "desc";
export type SortKey = "createdAt" | "dueDate";
export type RequestSort = { key: SortKey; direction: SortDirection };
/** Newest requests first unless the user sorts otherwise. */
export const defaultSort: RequestSort = { key: "createdAt", direction: "desc" };
export type DueState = "overdue" | "soon" | null;

export const DUE_SOON_DAYS = 3;
export const emptyFilters: RequestFilters = { query: "", statuses: [], categories: [], from: "", to: "", dateField: null };

export const pendingStatuses: RequestStatus[] = ["Enviada", "En revisión", "En gestión"];
const pending = pendingStatuses;

export function canEdit(status: RequestStatus) {
  return pending.includes(status);
}

export function canCancel(status: RequestStatus) {
  return status !== "Anulado";
}

const statusWords: Record<RequestStatus, string> = { "Enviada": "enviada", "En revisión": "en revisión", "En gestión": "en gestión", "Completada": "completada", "Rechazado": "rechazada", "Anulado": "anulada" };

/** The status as it reads after "la solicitud está …" (statuses are stored in masculine, as in the reference designs). */
export function statusPhrase(status: RequestStatus) {
  return statusWords[status];
}

/** An estimated resolution date can be set while the request still waits on a decision. */
export function canEstimate(status: RequestStatus) {
  return pending.includes(status);
}

/** The contract administrator authorizes, rejects or delegates only requests no department has yet. */
export function canDecide(status: RequestStatus) {
  return status === "Enviada" || status === "En revisión";
}

/** Opening a sent request is when the contract administrator starts reviewing it. */
export function startsReview(status: RequestStatus) {
  return status === "Enviada";
}

/** A department decides what was delegated to it. */
export function canDecideAsReviewer(status: RequestStatus) {
  return status === "En gestión";
}

/** Stored values before the En revisión / En gestión split: "En revisión" with a department is now "En gestión". */
export function normalizeLegacyStatus(request: Pick<MyRequest, "status" | "department">): RequestStatus {
  const status = request.status as string;
  if (status === "Autorizado") return "Completada";
  if (status === "En revisión" && request.department) return "En gestión";
  return request.status;
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

export function filterRequests<T extends MyRequest>(requests: T[], filters: RequestFilters, defaultField: DateField = "dueDate"): T[] {
  const field = filters.dateField ?? defaultField;
  // A request that has not reached that date yet (e.g. no resolution) is outside any range on it.
  const inRange = (request: T) => {
    if (!filters.from && !filters.to) return true;
    const date = request[field];
    return date !== null && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  };
  const query = filters.query.trim().toLowerCase();
  return requests.filter(request =>
    (!query || request.code.toLowerCase().includes(query)) &&
    (!filters.statuses.length || filters.statuses.includes(request.status)) &&
    (!filters.categories.length || filters.categories.includes(request.category)) &&
    inRange(request));
}

/** Sorts by creation or due date; requests on the same day follow their code (later codes are newer). */
export function sortRequests<T extends MyRequest>(requests: T[], { key, direction }: RequestSort): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...requests].sort((a, b) => sign * (a[key].localeCompare(b[key]) || a.code.localeCompare(b.code)));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, start, end: Math.min(start + pageSize, items.length) };
}

/** A package's progress: its children are decided one by one. */
export type PackageProgress = { label: "En curso" | "Finalizada" | "Anulada"; resolved: number; total: number; counts: Record<RequestStatus, number> };

/** The children of a package, in order. */
export function packageChildren<T extends MyRequest>(requests: T[], parentCode: string): T[] {
  return requests.filter(request => request.parentCode === parentCode).sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));
}

export function packageProgress(children: MyRequest[]): PackageProgress {
  const counts = countByStatus(children);
  const resolved = children.filter(child => !pending.includes(child.status)).length;
  const label = counts["Anulado"] === children.length ? "Anulada" : resolved === children.length ? "Finalizada" : "En curso";
  return { label, resolved, total: children.length, counts };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica una fecha válida.").refine(value => !Number.isNaN(Date.parse(value)), "Indica una fecha válida.");
const itemShape = {
  category: z.string().trim().min(1, "Selecciona la categoría.").max(80),
  element: z.string().trim().min(2, "Indica el tipo de elemento que necesitas.").max(120),
  elementLabel: z.string().trim().min(1).max(80).default("Tipo de elemento"),
  quantity: z.number({ invalid_type_error: "Indica la cantidad." }).positive("La cantidad debe ser mayor a 0.").max(1_000_000),
  fields: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().max(100), options: z.array(z.string().trim().max(100)).max(30).default([]) })).max(16),
};
const sharedShape = {
  dueDate: z.string().min(1, "La fecha de vencimiento es obligatoria.").pipe(isoDate),
  description: z.string().trim().max(4000),
  aiAssisted: z.boolean().default(false),
};
export const requestInputSchema = z.object({ ...itemShape, ...sharedShape });
export type RequestInput = z.infer<typeof requestInputSchema>;
/** "Nueva solicitud": one or more items sharing the due date and description; two or more become a package. */
export const requestPackageSchema = z.object({ ...sharedShape, items: z.array(z.object(itemShape)).min(1, "Agrega al menos un requerimiento.").max(10, "Una solicitud puede tener hasta 10 requerimientos.") });
export type RequestPackageInput = z.infer<typeof requestPackageSchema>;
/** Each item of a package as the input of its own request. */
export const itemsOf = ({ items, dueDate, description, aiAssisted }: RequestPackageInput): RequestInput[] => items.map(item => ({ ...item, dueDate, description, aiAssisted }));
const requestCode = z.string().regex(/^REQ-\d{4,}(-\d{1,2})?$/);
export const requestCodeSchema = z.object({ code: requestCode });
export const requestUpdateSchema = requestCodeSchema.extend({ input: requestInputSchema });
const itemEditSchema = z.object({
  as: z.string().trim().max(80).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
});
const itemTargetSchema = z.object({ code: requestCodeSchema.shape.code, key: z.string().max(300) });
export const catalogItemDecisionSchema = z.object({ targets: z.array(itemTargetSchema).min(1).max(200), status: z.enum(["aprobada", "rechazada"]), edit: itemEditSchema.default({}) });
const decisionFields = { decision: z.enum(["Completada", "Rechazado"]), reason: z.string().trim().max(1000).optional() };
export const REJECTION_REASON_MIN = 10;
const reasonRequired = (value: { decision: string; reason?: string | undefined }) => value.decision !== "Rechazado" || (value.reason?.length ?? 0) >= REJECTION_REASON_MIN;
const reasonMessage = { message: `Escribe la razón del rechazo (al menos ${REJECTION_REASON_MIN} caracteres).`, path: ["reason"] };
export const requestDecisionSchema = requestCodeSchema.extend(decisionFields).refine(reasonRequired, reasonMessage);
export const reviewerSchema = z.object({ department: z.string().max(80), assigneeName: z.string().max(120) })
  .refine(value => findMember(value.department, value.assigneeName), "Elige un encargado del departamento seleccionado.");
export const reviewerDecisionSchema = z.object({ reviewer: reviewerSchema, code: requestCodeSchema.shape.code, ...decisionFields }).refine(reasonRequired, reasonMessage);
/** Sets (or clears, with null) the estimated resolution date; with `reviewer`, as that department reviewer. */
export const estimateSchema = requestCodeSchema.extend({ date: isoDate.nullable(), reviewer: reviewerSchema.optional() });
export const reviewerPackageSchema = z.object({ reviewer: reviewerSchema, parentCode: requestCode });
export const requestDelegationSchema = requestCodeSchema.extend({ department: z.string().max(80), assigneeName: z.string().max(120) })
  .refine(value => findMember(value.department, value.assigneeName), "Elige un encargado del departamento seleccionado.");

/** Turns validated form input into the stored request fields; unit comes from the "Unidad" field when present. */
export function requestFromInput(input: RequestInput) {
  const fields = input.fields.filter(field => field.value).map(({ label, value }) => ({ label, value }));
  const unit = fields.find(field => field.label.toLowerCase() === "unidad")?.value ?? "Unidades";
  return { category: input.category, element: input.element, elementLabel: input.elementLabel, quantity: input.quantity, unit, dueDate: input.dueDate, description: input.description, fields, aiAssisted: input.aiAssisted && input.description.length > 0 };
}

const sampleRejection = "No hay presupuesto disponible este mes para este requerimiento; vuelve a solicitarlo el próximo período.";

type Sample = Pick<MyRequest, "category" | "element" | "quantity" | "unit" | "description" | "fields" | "aiAssisted">;
const samples: Sample[] = [
  { category: "Herramientas", element: "Taladro percutor", quantity: 4, unit: "Unidades", description: "", aiAssisted: false, fields: [{ label: "Marca", value: "Bosch" }, { label: "Alimentación", value: "Batería" }] },
  { category: "Maquinarias", element: "Grúa horquilla", quantity: 1, unit: "Días", description: "Necesito una grúa horquilla un día para descargar materiales en bodega.", aiAssisted: true, fields: [{ label: "Unidad", value: "Días" }, { label: "Capacidad", value: "5 toneladas" }, { label: "Alimentación", value: "Diésel" }] },
  { category: "Personas", element: "Soldador", quantity: 2, unit: "Unidades", description: "", aiAssisted: false, fields: [{ label: "Especialidad", value: "Soldador" }] },
  { category: "Materiales", element: "Perfil de acero", quantity: 120, unit: "Metros", description: "Perfil de acero para refuerzo de plataforma.", aiAssisted: false, fields: [{ label: "Unidad", value: "Metros" }, { label: "Material", value: "Acero" }, { label: "Dimensiones", value: "Grande" }] },
  { category: "Alimentos", element: "Colación", quantity: 60, unit: "Unidades", description: "", aiAssisted: false, fields: [{ label: "Formato", value: "Caja" }] },
  { category: "Bebestible", element: "Agua purificada", quantity: 50, unit: "Litros", description: "Agua purificada para la faena en zona de altura, en botellas.", aiAssisted: true, fields: [{ label: "Unidad", value: "Litros" }, { label: "Tipo de bebestible", value: "Agua" }, { label: "Formato", value: "Botella" }] },
  { category: "Materiales", element: "Tornillo autoperforante", quantity: 200, unit: "Pulgadas", description: "Quiero un tornillo de esos con surcos en cruz de un tamaño de 3/4.", aiAssisted: true, fields: [{ label: "Unidad", value: "Pulgadas" }, { label: "Material", value: "Acero" }, { label: "Tipo de tornillo", value: "Cabeza Phillips 3/4\"" }] },
];

const seededElement = (category: string, element: string) => (defaultElements[category] ?? []).some(name => normalizeForSearch(name) === normalizeForSearch(element));

/** Delegated requests carry their department; decided ones alternate between department and direct ADC decisions. */
function sampleAssignment(sample: Sample, status: RequestStatus, index: number): Pick<MyRequest, "department" | "assignee"> {
  const delegated = status === "En gestión" || ((status === "Completada" || status === "Rechazado") && index % 2 === 0);
  if (!delegated) return { department: null, assignee: null };
  const rule = delegationByRules(sample.category);
  return { department: rule.department, assignee: rule.assignee };
}

// Status mix matches the reference summary: 15 completed, 5 with a department, 2 rejected, 10 sent (3 already in review).
const statusPlan: RequestStatus[] = [
  ...Array<RequestStatus>(15).fill("Completada"),
  ...Array<RequestStatus>(5).fill("En gestión"),
  ...Array<RequestStatus>(2).fill("Rechazado"),
  ...Array<RequestStatus>(7).fill("Enviada"),
  ...Array<RequestStatus>(3).fill("En revisión"),
  ...Array<RequestStatus>(2).fill("Anulado"),
];
const dueOffsets = [-18, 21, 1, 9, 2, -1, 14, 30, 5, 0, 3, 12, -6, 17, 7, 25, 4, -3, 10, 2];

/** When each step happened, a few days apart and never after today, so the dashboards have a history to show. */
function sampleTimeline(today: string, createdAt: string, status: RequestStatus, delegated: boolean, index: number): Pick<MyRequest, "reviewStartedAt" | "delegatedAt" | "resolvedAt"> {
  const notAfterToday = (iso: string) => (iso > today ? today : iso);
  const reviewed = status !== "Enviada" && status !== "Anulado";
  const reviewStartedAt = reviewed ? notAfterToday(addDays(createdAt, 1)) : null;
  const delegatedAt = delegated && reviewStartedAt ? notAfterToday(addDays(reviewStartedAt, 1 + (index % 2))) : null;
  const resolved = status === "Completada" || status === "Rechazado" || status === "Anulado";
  const resolvedAt = resolved ? notAfterToday(addDays(delegatedAt ?? reviewStartedAt ?? createdAt, 2 + (index % 6))) : null;
  return { reviewStartedAt, delegatedAt, resolvedAt };
}

function buildSample(today: string, requester: Person, status: RequestStatus, index: number, code: number): MyRequest {
  const sample = samples[index % samples.length]!;
  const dueDate = addDays(today, dueOffsets[index % dueOffsets.length]! + (status === "Completada" ? -10 : 0));
  const created = addDays(dueDate, -14);
  const createdAt = [created, addDays(today, -1 - (index % 9))].sort()[0]!;
  return {
    ...sample,
    ...sampleAssignment(sample, status, index),
    code: `REQ-${String(code).padStart(4, "0")}`,
    requester,
    // Spread creation days so sorting by creation date shows a realistic mix.
    createdAt,
    ...sampleTimeline(today, createdAt, status, sampleAssignment(sample, status, index).department !== null, index),
    dueDate,
    status,
    rejectionReason: status === "Rechazado" ? sampleRejection : null,
    parentCode: null,
    estimatedResolution: status === "En gestión" || status === "En revisión" || (status === "Enviada" && index % 3 === 0) ? addDays(dueDate, -2) : null,
    // The seed proposes the same things a requester would: e.g. the new "Bebestible" type or the "Tipo de tornillo" attribute.
    elementLabel: elementLabelFor(defaultCatalog, sample.category),
    proposal: proposalFor(defaultCatalog, sample.category, sample.fields.map(field => ({ ...field, options: [] })), sample.element, seededElement),
  };
}

/** The demo user's sample requests; dates are relative to `today` so due warnings stay visible. */
export function sampleRequests(today: string): MyRequest[] {
  return statusPlan.map((status, index) => buildSample(today, DEMO_USER, status, index, 1201 + index * 7));
}

// Other requesters' work, so the contract administrator's queue has more than the demo user's requests.
const teamPlan: RequestStatus[] = ["Enviada", "Enviada", "Enviada", "Enviada", "Enviada", "Enviada", "En revisión", "En revisión", "En gestión", "En gestión", "En gestión", "Completada", "Completada", "Rechazado"];

/** A package: several items asked for together, each its own request with its own status. */
function samplePackage(today: string, requester: Person, parent: number, items: { sample: number; status: RequestStatus }[], description: string): MyRequest[] {
  const parentCode = `REQ-${parent}`;
  return items.map(({ sample, status }, index) => {
    const child = buildSample(today, requester, status, sample, parent);
    return {
      ...child, code: `${parentCode}-${index + 1}`, parentCode, description, aiAssisted: true,
      createdAt: addDays(today, -2), dueDate: addDays(today, 12), estimatedResolution: child.estimatedResolution && addDays(today, 9),
      ...sampleTimeline(today, addDays(today, -2), status, child.department !== null, index),
    };
  });
}

/** Seed for development storage: the demo user's requests plus those of the rest of the team. */
export function seedRequests(today: string): MyRequest[] {
  const team = teamPlan.map((status, index) => buildSample(today, requesters[1 + (index % 2)]!, status, index + 3, 1440 + index * 3));
  const mine = samplePackage(today, DEMO_USER, 1490, [{ sample: 2, status: "Completada" }, { sample: 1, status: "En gestión" }, { sample: 0, status: "Enviada" }],
    "Para el montaje de la plataforma necesito 2 soldadores, una grúa horquilla por un día y 4 taladros percutores Bosch a batería.");
  const theirs = samplePackage(today, requesters[1]!, 1495, [{ sample: 4, status: "Enviada" }, { sample: 5, status: "Enviada" }],
    "Colaciones en caja y agua purificada en botella para la cuadrilla de la faena de altura.");
  return [...sampleRequests(today), ...team, ...mine, ...theirs];
}
