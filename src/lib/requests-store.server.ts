import type { SupabaseClient } from "@supabase/supabase-js";
import { seedRequests, todayIso, type MyRequest } from "./my-requests";

export type NewRequest = Omit<MyRequest, "code" | "createdAt" | "status" | "department" | "assignee">;
export type RequestPatch = Partial<Omit<MyRequest, "code" | "createdAt" | "requester">>;

/** Plain persistence; who may see or change a request is decided in requests.server.ts. */
export interface RequestStore {
  list(filter?: { requesterEmail?: string }): Promise<MyRequest[]>;
  get(code: string): Promise<MyRequest | null>;
  create(request: NewRequest): Promise<MyRequest>;
  update(code: string, patch: RequestPatch): Promise<MyRequest | null>;
}

type RequestRow = {
  code: string; requester: string; requester_name: string; requester_role: string; category: string; quantity: number | string;
  unit: string; description: string; ai_assisted: boolean; fields: { label: string; value: string }[]; due_date: string;
  status: MyRequest["status"]; department: string | null; assignee_name: string | null; assignee_role: string | null;
  assignee_email: string | null; catalog_proposal: MyRequest["proposal"]; created_at: string;
};

const fromRow = (row: RequestRow): MyRequest => ({
  code: row.code, requester: { email: row.requester, name: row.requester_name, role: row.requester_role },
  category: row.category, quantity: Number(row.quantity), unit: row.unit, description: row.description, aiAssisted: row.ai_assisted,
  fields: row.fields ?? [], dueDate: row.due_date, status: row.status, createdAt: row.created_at.slice(0, 10), department: row.department,
  assignee: row.assignee_name ? { name: row.assignee_name, role: row.assignee_role ?? "", email: row.assignee_email ?? "" } : null,
  proposal: row.catalog_proposal ?? null,
});

function toRow(patch: RequestPatch & Partial<Pick<MyRequest, "requester">>) {
  const row: Partial<Omit<RequestRow, "code" | "created_at">> = {};
  if (patch.requester !== undefined) { row.requester = patch.requester.email; row.requester_name = patch.requester.name; row.requester_role = patch.requester.role; }
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.aiAssisted !== undefined) row.ai_assisted = patch.aiAssisted;
  if (patch.fields !== undefined) row.fields = patch.fields;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.department !== undefined) row.department = patch.department;
  if (patch.proposal !== undefined) row.catalog_proposal = patch.proposal;
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
      let query = table().select("*").order("due_date");
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
    async update(code, patch) {
      const { data, error } = await table().update({ ...toRow(patch), updated_at: new Date().toISOString() }).eq("code", code).select("*").maybeSingle();
      if (error) fail(error);
      return data ? fromRow(data as RequestRow) : null;
    },
  };
}

/** Development-only store in .data/requests.json, seeded with sample requests so every status and role can be tried. */
export function fileStore(path: string, seed: () => MyRequest[] = () => seedRequests(todayIso())): RequestStore {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>) => { const next = queue.then(task, task); queue = next.catch(() => undefined); return next; };
  const read = async (): Promise<MyRequest[]> => {
    const fs = await import("node:fs/promises");
    try { return (JSON.parse(await fs.readFile(path, "utf8")) as MyRequest[]).map(request => ({ ...request, proposal: request.proposal ?? null })); } catch (error) {
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
      const next = Math.max(1200, ...requests.map(r => Number(r.code.slice(4)) || 0)) + 1;
      const created: MyRequest = { ...request, code: `REQ-${String(next).padStart(4, "0")}`, createdAt: todayIso(), status: "Enviada", department: null, assignee: null };
      await write([...requests, created]);
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
