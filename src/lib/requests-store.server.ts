import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLegacyStatus, seedRequests, todayIso, type MyRequest } from "./my-requests";

export type NewRequest = Omit<MyRequest, "code" | "createdAt" | "status" | "department" | "assignee" | "rejectionReason" | "estimatedResolution" | "parentCode" | "reviewStartedAt" | "delegatedAt" | "resolvedAt">;
export type RequestPatch = Partial<Omit<MyRequest, "code" | "createdAt" | "requester">>;

/** Plain persistence; who may see or change a request is decided in requests.server.ts. */
export interface RequestStore {
  list(filter?: { requesterEmail?: string }): Promise<MyRequest[]>;
  get(code: string): Promise<MyRequest | null>;
  create(request: NewRequest): Promise<MyRequest>;
  /** Creates the requests of a package under one new parent code, as REQ-1501-1, REQ-1501-2… */
  createPackage(requests: NewRequest[]): Promise<MyRequest[]>;
  update(code: string, patch: RequestPatch): Promise<MyRequest | null>;
}

type RequestRow = {
  code: string; requester: string; requester_name: string; requester_role: string; category: string; element: string | null; element_label: string | null; quantity: number | string;
  unit: string; description: string; ai_assisted: boolean; fields: { label: string; value: string }[]; due_date: string;
  status: MyRequest["status"]; department: string | null; assignee_name: string | null; assignee_role: string | null;
  assignee_email: string | null; catalog_proposal: MyRequest["proposal"]; created_at: string;
  rejection_reason: string | null; estimated_resolution: string | null; parent_code: string | null;
  review_started_at: string | null; delegated_at: string | null; resolved_at: string | null;
};

const fromRow = (row: RequestRow): MyRequest => ({
  code: row.code, requester: { email: row.requester, name: row.requester_name, role: row.requester_role },
  category: row.category, element: row.element ?? "", elementLabel: row.element_label ?? "Tipo de elemento", quantity: Number(row.quantity), unit: row.unit, description: row.description, aiAssisted: row.ai_assisted,
  fields: row.fields ?? [], dueDate: row.due_date, status: normalizeLegacyStatus(row), createdAt: row.created_at.slice(0, 10), department: row.department,
  assignee: row.assignee_name ? { name: row.assignee_name, role: row.assignee_role ?? "", email: row.assignee_email ?? "" } : null,
  proposal: row.catalog_proposal ?? null,
  rejectionReason: row.rejection_reason ?? null, estimatedResolution: row.estimated_resolution ?? null, parentCode: row.parent_code ?? null,
  reviewStartedAt: row.review_started_at?.slice(0, 10) ?? null, delegatedAt: row.delegated_at?.slice(0, 10) ?? null, resolvedAt: row.resolved_at?.slice(0, 10) ?? null,
});

function toRow(patch: RequestPatch & Partial<Pick<MyRequest, "requester">>) {
  const row: Partial<Omit<RequestRow, "code" | "created_at">> = {};
  if (patch.requester !== undefined) { row.requester = patch.requester.email; row.requester_name = patch.requester.name; row.requester_role = patch.requester.role; }
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.element !== undefined) row.element = patch.element;
  if (patch.elementLabel !== undefined) row.element_label = patch.elementLabel;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.aiAssisted !== undefined) row.ai_assisted = patch.aiAssisted;
  if (patch.fields !== undefined) row.fields = patch.fields;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.department !== undefined) row.department = patch.department;
  if (patch.proposal !== undefined) row.catalog_proposal = patch.proposal;
  if (patch.rejectionReason !== undefined) row.rejection_reason = patch.rejectionReason;
  if (patch.estimatedResolution !== undefined) row.estimated_resolution = patch.estimatedResolution;
  if (patch.reviewStartedAt !== undefined) row.review_started_at = patch.reviewStartedAt;
  if (patch.delegatedAt !== undefined) row.delegated_at = patch.delegatedAt;
  if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;
  if (patch.assignee !== undefined) { row.assignee_name = patch.assignee?.name ?? null; row.assignee_role = patch.assignee?.role ?? null; row.assignee_email = patch.assignee?.email ?? null; }
  return row;
}

async function supabaseStore(): Promise<RequestStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The generated Database types do not list `requests` until Lovable regenerates them after the migration.
  const table = () => (supabaseAdmin as unknown as SupabaseClient).from("requests");
  const fail = (error: { message: string }): never => { throw new Error(`[requests] ${error.message}`); };
  return {
    async list(filter) {
      let query = table().select("*").order("created_at", { ascending: false });
      if (filter?.requesterEmail) query = query.eq("requester", filter.requesterEmail);
      const { data, error } = await query;
      if (error) fail(error);
      return (data as RequestRow[]).map(fromRow);
    },
    async get(code) {
      const { data, error } = await table().select("*").eq("code", code).maybeSingle();
      if (error) fail(error);
      return data ? fromRow(data as RequestRow) : null;
    },
    async create(request) {
      const { data, error } = await table().insert(toRow(request)).select("*").single();
      if (error) fail(error);
      return fromRow(data as RequestRow);
    },
    async createPackage(requests) {
      // The parent takes a number from the same sequence, so REQ-1501 never collides with a single request.
      const { data: parent, error: codeError } = await (supabaseAdmin as unknown as SupabaseClient).rpc("next_request_code");
      if (codeError) fail(codeError);
      const rows = requests.map((request, index) => ({ ...toRow(request), code: `${parent as string}-${index + 1}`, parent_code: parent as string }));
      const { data, error } = await table().insert(rows).select("*").order("code");
      if (error) fail(error);
      return (data as RequestRow[]).map(fromRow);
    },
    async update(code, patch) {
      const { data, error } = await table().update({ ...toRow(patch), updated_at: new Date().toISOString() }).eq("code", code).select("*").maybeSingle();
      if (error) fail(error);
      return data ? fromRow(data as RequestRow) : null;
    },
  };
}

const fresh = () => ({ createdAt: todayIso(), status: "Enviada" as const, department: null, assignee: null, rejectionReason: null, estimatedResolution: null, reviewStartedAt: null, delegatedAt: null, resolvedAt: null });
/** Next number after every single request and package (children share their parent's number). */
const nextCode = (requests: MyRequest[]) => `REQ-${String(Math.max(1200, ...requests.map(r => Number.parseInt(r.code.slice(4), 10) || 0)) + 1).padStart(4, "0")}`;

/** Development-only store in .data/requests.json, seeded with sample requests so every status and role can be tried. */
export function fileStore(path: string, seed: () => MyRequest[] = () => seedRequests(todayIso())): RequestStore {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>) => { const next = queue.then(task, task); queue = next.catch(() => undefined); return next; };
  const read = async (): Promise<MyRequest[]> => {
    const fs = await import("node:fs/promises");
    try {
      // Files written before a field existed get its empty value; statuses from before En gestión are mapped.
      return (JSON.parse(await fs.readFile(path, "utf8")) as MyRequest[]).map(request => ({
        ...request, status: normalizeLegacyStatus(request), element: request.element ?? "", elementLabel: request.elementLabel ?? "Tipo de elemento", proposal: request.proposal ?? null,
        rejectionReason: request.rejectionReason ?? null, estimatedResolution: request.estimatedResolution ?? null, parentCode: request.parentCode ?? null,
        reviewStartedAt: request.reviewStartedAt ?? null, delegatedAt: request.delegatedAt ?? null, resolvedAt: request.resolvedAt ?? null,
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const seeded = seed();
      await write(seeded);
      return seeded;
    }
  };
  const write = async (requests: MyRequest[]) => {
    const fs = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(`${path}.tmp`, JSON.stringify(requests, null, 2));
    await fs.rename(`${path}.tmp`, path);
  };
  return {
    list: filter => serial(async () => (await read()).filter(r => !filter?.requesterEmail || r.requester.email === filter.requesterEmail)),
    get: code => serial(async () => (await read()).find(r => r.code === code) ?? null),
    create: request => serial(async () => {
      const requests = await read();
      const created: MyRequest = { ...request, ...fresh(), code: nextCode(requests), parentCode: null };
      await write([...requests, created]);
      return created;
    }),
    createPackage: items => serial(async () => {
      const requests = await read();
      const parentCode = nextCode(requests);
      const created = items.map((request, index): MyRequest => ({ ...request, ...fresh(), code: `${parentCode}-${index + 1}`, parentCode }));
      await write([...requests, ...created]);
      return created;
    }),
    update: (code, patch) => serial(async () => {
      const requests = await read();
      const index = requests.findIndex(r => r.code === code);
      if (index < 0) return null;
      const updated = { ...requests[index]!, ...patch };
      requests[index] = updated;
      await write(requests);
      return updated;
    }),
  };
}

let store: Promise<RequestStore> | undefined;

export function getRequestStore(): Promise<RequestStore> {
  store ??= (async () => {
    if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) return supabaseStore();
    if (process.env["NODE_ENV"] === "production") throw new Error("Las solicitudes requieren Lovable Cloud configurado.");
    const { resolve } = await import("node:path");
    return fileStore(resolve(process.cwd(), ".data", "requests.json"));
  })();
  return store;
}
