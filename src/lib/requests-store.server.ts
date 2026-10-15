import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_REQUESTER, sampleRequests, todayIso, type MyRequest, type RequestStatus } from "./my-requests";

export type NewRequest = Omit<MyRequest, "code" | "createdAt" | "status">;
export type RequestPatch = Partial<NewRequest> & { status?: RequestStatus };

export interface RequestStore {
  list(requester: string): Promise<MyRequest[]>;
  get(requester: string, code: string): Promise<MyRequest | null>;
  create(requester: string, request: NewRequest): Promise<MyRequest>;
  update(requester: string, code: string, patch: RequestPatch): Promise<MyRequest | null>;
}

type RequestRow = {
  code: string; requester: string; category: string; quantity: number | string; unit: string; description: string;
  fields: { label: string; value: string }[]; due_date: string; status: RequestStatus;
  authorizer_name: string; authorizer_role: string; created_at: string;
};

const fromRow = (row: RequestRow): MyRequest => ({
  code: row.code, category: row.category, quantity: Number(row.quantity), unit: row.unit, description: row.description,
  fields: row.fields ?? [], dueDate: row.due_date, status: row.status, createdAt: row.created_at.slice(0, 10),
  authorizer: { name: row.authorizer_name, role: row.authorizer_role },
});

function toRow(patch: RequestPatch) {
  const row: Partial<Omit<RequestRow, "code" | "requester" | "created_at">> = {};
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.fields !== undefined) row.fields = patch.fields;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.authorizer !== undefined) { row.authorizer_name = patch.authorizer.name; row.authorizer_role = patch.authorizer.role; }
  return row;
}

async function supabaseStore(): Promise<RequestStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The generated Database types do not list `requests` until Lovable regenerates them after the migration.
  const table = () => (supabaseAdmin as unknown as SupabaseClient).from("requests");
  const fail = (error: { message: string }): never => { throw new Error(`[requests] ${error.message}`); };
  return {
    async list(requester) {
      const { data, error } = await table().select("*").eq("requester", requester).order("due_date");
      if (error) fail(error);
      return (data as RequestRow[]).map(fromRow);
    },
    async get(requester, code) {
      const { data, error } = await table().select("*").eq("requester", requester).eq("code", code).maybeSingle();
      if (error) fail(error);
      return data ? fromRow(data as RequestRow) : null;
    },
    async create(requester, request) {
      const { data, error } = await table().insert({ requester, ...toRow(request) }).select("*").single();
      if (error) fail(error);
      return fromRow(data as RequestRow);
    },
    async update(requester, code, patch) {
      const { data, error } = await table().update({ ...toRow(patch), updated_at: new Date().toISOString() }).eq("requester", requester).eq("code", code).select("*").maybeSingle();
      if (error) fail(error);
      return data ? fromRow(data as RequestRow) : null;
    },
  };
}

type StoredRequest = MyRequest & { requester: string };

/** Development-only store in .data/requests.json, seeded with sample requests so every status can be tried. */
export function fileStore(path: string): RequestStore {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>) => { const next = queue.then(task, task); queue = next.catch(() => undefined); return next; };
  const read = async (): Promise<StoredRequest[]> => {
    const fs = await import("node:fs/promises");
    try { return JSON.parse(await fs.readFile(path, "utf8")) as StoredRequest[]; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const seeded = sampleRequests(todayIso()).map(request => ({ ...request, requester: DEMO_REQUESTER }));
      await write(seeded);
      return seeded;
    }
  };
  const write = async (requests: StoredRequest[]) => {
    const fs = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(`${path}.tmp`, JSON.stringify(requests, null, 2));
    await fs.rename(`${path}.tmp`, path);
  };
  const strip = ({ requester: _requester, ...request }: StoredRequest): MyRequest => request;
  return {
    list: requester => serial(async () => (await read()).filter(r => r.requester === requester).map(strip)),
    get: (requester, code) => serial(async () => { const found = (await read()).find(r => r.requester === requester && r.code === code); return found ? strip(found) : null; }),
    create: (requester, request) => serial(async () => {
      const requests = await read();
      const next = Math.max(1200, ...requests.map(r => Number(r.code.slice(4)) || 0)) + 1;
      const created: StoredRequest = { ...request, requester, code: `REQ-${String(next).padStart(4, "0")}`, createdAt: todayIso(), status: "Enviada" };
      await write([...requests, created]);
      return strip(created);
    }),
    update: (requester, code, patch) => serial(async () => {
      const requests = await read();
      const index = requests.findIndex(r => r.requester === requester && r.code === code);
      if (index < 0) return null;
      const updated = { ...requests[index]!, ...patch };
      requests[index] = updated;
      await write(requests);
      return strip(updated);
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
