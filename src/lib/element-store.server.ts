import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultElements, normalizeForSearch, searchElements, SUGGESTION_LIMIT } from "./elements";

export type MasterElement = { name: string; aliases: string[] };

/** Master catalogs of element types per category. Only approved elements (see requests.server.ts) are added. */
export interface ElementStore {
  search(category: string, query: string, limit?: number): Promise<string[]>;
  /** The approved name for each (category, element) that is already in a master catalog, by name or alias. */
  resolve(pairs: { category: string; name: string }[]): Promise<Map<string, string>>;
  all(): Promise<Record<string, MasterElement[]>>;
  add(category: string, name: string, alias?: string): Promise<void>;
  /** Renames an element, keeping the old name as an alias. Fails if the new name is already taken. */
  rename(category: string, name: string, to: string): Promise<void>;
  remove(category: string, name: string): Promise<void>;
  /** Moves or drops a whole category's master catalog when the category is renamed or deleted. */
  renameCategory(from: string, to: string): Promise<void>;
  removeCategory(category: string): Promise<void>;
}

export class ElementEditError extends Error {}

/** Lookup key for `resolve`: the same category and element regardless of case and accents. */
export const elementKey = (category: string, name: string) => `${normalizeForSearch(category)}|${normalizeForSearch(name)}`;

const seed = (): Record<string, MasterElement[]> =>
  Object.fromEntries(Object.entries(defaultElements).map(([category, names]) => [category, names.map(name => ({ name, aliases: [] }))]));

/** Shared by the memory and file stores: everything is in one object, searched with the JS trigram ranking. */
function documentStore(read: () => Promise<Record<string, MasterElement[]>>, write: (data: Record<string, MasterElement[]>) => Promise<void>): ElementStore {
  const inCategory = (data: Record<string, MasterElement[]>, category: string) =>
    Object.entries(data).find(([name]) => normalizeForSearch(name) === normalizeForSearch(category))?.[1] ?? [];
  return {
    async search(category, query, limit = SUGGESTION_LIMIT) {
      const elements = inCategory(await read(), category);
      return searchElements(elements.map(element => element.name), query, limit);
    },
    async resolve(pairs) {
      const data = await read();
      const found = new Map<string, string>();
      for (const pair of pairs) {
        const wanted = normalizeForSearch(pair.name);
        const match = inCategory(data, pair.category).find(element => [element.name, ...element.aliases].some(name => normalizeForSearch(name) === wanted));
        if (match) found.set(elementKey(pair.category, pair.name), match.name);
      }
      return found;
    },
    all: read,
    async add(category, name, alias) {
      const data = await read();
      const existingCategory = Object.keys(data).find(entry => normalizeForSearch(entry) === normalizeForSearch(category)) ?? category;
      const elements = data[existingCategory] ?? [];
      let element = elements.find(entry => normalizeForSearch(entry.name) === normalizeForSearch(name));
      if (!element) { element = { name, aliases: [] }; elements.push(element); }
      if (alias && normalizeForSearch(alias) !== normalizeForSearch(element.name) && !element.aliases.some(a => normalizeForSearch(a) === normalizeForSearch(alias))) element.aliases.push(alias);
      data[existingCategory] = elements;
      await write(data);
    },
    async rename(category, name, to) {
      const data = await read();
      const elements = inCategory(data, category);
      const element = elements.find(entry => normalizeForSearch(entry.name) === normalizeForSearch(name));
      if (!element) throw new ElementEditError(`«${name}» ya no está en el catálogo maestro.`);
      const clash = elements.find(entry => entry !== element && normalizeForSearch(entry.name) === normalizeForSearch(to));
      if (clash) throw new ElementEditError(`Ya existe «${clash.name}» en el catálogo maestro.`);
      element.aliases = [...element.aliases.filter(alias => normalizeForSearch(alias) !== normalizeForSearch(to)), ...(normalizeForSearch(element.name) !== normalizeForSearch(to) ? [element.name] : [])];
      element.name = to.trim();
      await write(data);
    },
    async remove(category, name) {
      const data = await read();
      const key = Object.keys(data).find(entry => normalizeForSearch(entry) === normalizeForSearch(category));
      if (!key) return;
      data[key] = data[key]!.filter(entry => normalizeForSearch(entry.name) !== normalizeForSearch(name));
      await write(data);
    },
    async renameCategory(from, to) {
      const data = await read();
      const key = Object.keys(data).find(entry => normalizeForSearch(entry) === normalizeForSearch(from));
      if (!key) return;
      data[to] = [...(data[to] ?? []), ...data[key]!];
      if (key !== to) delete data[key];
      await write(data);
    },
    async removeCategory(category) {
      const data = await read();
      for (const key of Object.keys(data)) if (normalizeForSearch(key) === normalizeForSearch(category)) delete data[key];
      await write(data);
    },
  };
}

/** In-memory master catalogs, for tests. */
export function memoryElementStore(initial: Record<string, MasterElement[]> = seed()): ElementStore {
  let data = structuredClone(initial);
  return documentStore(async () => structuredClone(data), async next => { data = structuredClone(next); });
}

/** Development-only master catalogs in .data/elements.json, starting from the suggested elements of each category. */
export function fileElementStore(path: string): ElementStore {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>) => { const next = queue.then(task, task); queue = next.catch(() => undefined); return next; };
  const read = async (): Promise<Record<string, MasterElement[]>> => {
    const fs = await import("node:fs/promises");
    try { return JSON.parse(await fs.readFile(path, "utf8")) as Record<string, MasterElement[]>; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return seed();
    }
  };
  const write = async (data: Record<string, MasterElement[]>) => {
    const fs = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(`${path}.tmp`, JSON.stringify(data, null, 2));
    await fs.rename(`${path}.tmp`, path);
  };
  const store = documentStore(read, write);
  return {
    search: (category, query, limit) => serial(() => store.search(category, query, limit)),
    resolve: pairs => serial(() => store.resolve(pairs)),
    all: () => serial(() => store.all()),
    add: (category, name, alias) => serial(() => store.add(category, name, alias)),
    rename: (category, name, to) => serial(() => store.rename(category, name, to)),
    remove: (category, name) => serial(() => store.remove(category, name)),
    renameCategory: (from, to) => serial(() => store.renameCategory(from, to)),
    removeCategory: category => serial(() => store.removeCategory(category)),
  };
}

type ElementRow = { category: string; name: string; aliases: string[] | null };

/** Lovable Cloud: suggestions come from pg_trgm (`search_requirement_elements`, see the migration). */
async function supabaseElementStore(): Promise<ElementStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The generated Database types do not list this table until Lovable regenerates them after the migration.
  const db = supabaseAdmin as unknown as SupabaseClient;
  const fail = (error: { message: string }): never => { throw new Error(`[elements] ${error.message}`); };
  return {
    async search(category, query, limit = SUGGESTION_LIMIT) {
      const { data, error } = await db.rpc("search_requirement_elements", { p_category: category, p_query: query, p_limit: limit });
      if (error) fail(error);
      return (data as { name: string }[]).map(row => row.name);
    },
    async resolve(pairs) {
      const found = new Map<string, string>();
      const categories = [...new Set(pairs.map(pair => pair.category))];
      if (!categories.length) return found;
      const { data, error } = await db.from("requirement_elements").select("category, name, aliases").in("category", categories);
      if (error) fail(error);
      const rows = data as ElementRow[];
      for (const pair of pairs) {
        const wanted = normalizeForSearch(pair.name);
        const match = rows.find(row => normalizeForSearch(row.category) === normalizeForSearch(pair.category) && [row.name, ...(row.aliases ?? [])].some(name => normalizeForSearch(name) === wanted));
        if (match) found.set(elementKey(pair.category, pair.name), match.name);
      }
      return found;
    },
    async all() {
      const { data, error } = await db.from("requirement_elements").select("category, name, aliases").order("name");
      if (error) fail(error);
      const result: Record<string, MasterElement[]> = {};
      for (const row of data as ElementRow[]) (result[row.category] ??= []).push({ name: row.name, aliases: row.aliases ?? [] });
      return result;
    },
    async add(category, name, alias) {
      const { data, error } = await db.from("requirement_elements").select("id, name, aliases").eq("category", category);
      if (error) fail(error);
      const existing = (data as (ElementRow & { id: number })[]).find(row => normalizeForSearch(row.name) === normalizeForSearch(name));
      if (!existing) {
        const inserted = await db.from("requirement_elements").insert({ category, name, aliases: alias && normalizeForSearch(alias) !== normalizeForSearch(name) ? [alias] : [] });
        if (inserted.error) fail(inserted.error);
      } else if (alias && normalizeForSearch(alias) !== normalizeForSearch(existing.name) && !(existing.aliases ?? []).some(a => normalizeForSearch(a) === normalizeForSearch(alias))) {
        const updated = await db.from("requirement_elements").update({ aliases: [...(existing.aliases ?? []), alias] }).eq("id", existing.id);
        if (updated.error) fail(updated.error);
      }
    },
    async rename(category, name, to) {
      const { data, error } = await db.from("requirement_elements").select("id, name, aliases").eq("category", category);
      if (error) fail(error);
      const rows = data as (ElementRow & { id: number })[];
      const element = rows.find(row => normalizeForSearch(row.name) === normalizeForSearch(name));
      if (!element) throw new ElementEditError(`«${name}» ya no está en el catálogo maestro.`);
      const clash = rows.find(row => row.id !== element.id && normalizeForSearch(row.name) === normalizeForSearch(to));
      if (clash) throw new ElementEditError(`Ya existe «${clash.name}» en el catálogo maestro.`);
      const aliases = [...(element.aliases ?? []).filter(alias => normalizeForSearch(alias) !== normalizeForSearch(to)), ...(normalizeForSearch(element.name) !== normalizeForSearch(to) ? [element.name] : [])];
      const updated = await db.from("requirement_elements").update({ name: to.trim(), aliases }).eq("id", element.id);
      if (updated.error) fail(updated.error);
    },
    async remove(category, name) {
      const { data, error } = await db.from("requirement_elements").select("id, name").eq("category", category);
      if (error) fail(error);
      const ids = (data as { id: number; name: string }[]).filter(row => normalizeForSearch(row.name) === normalizeForSearch(name)).map(row => row.id);
      if (ids.length) { const removed = await db.from("requirement_elements").delete().in("id", ids); if (removed.error) fail(removed.error); }
    },
    // In Lovable Cloud elements follow their category row through ON UPDATE / ON DELETE CASCADE.
    async renameCategory() {},
    async removeCategory() {},
  };
}

let store: Promise<ElementStore> | undefined;

export function getElementStore(): Promise<ElementStore> {
  store ??= (async () => {
    if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) return supabaseElementStore();
    if (process.env["NODE_ENV"] === "production") throw new Error("Los catálogos maestros requieren Lovable Cloud configurado.");
    const { resolve } = await import("node:path");
    return fileElementStore(resolve(process.cwd(), ".data", "elements.json"));
  })();
  return store;
}
