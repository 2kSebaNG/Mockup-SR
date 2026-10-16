import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultCatalog, type Catalog } from "./catalog";
import { DEFAULT_ELEMENT_LABEL } from "./elements";

/** The approved catalog. Only an approved proposal (see requests.server.ts) may call `update`. */
export interface CatalogStore {
  get(): Promise<Catalog>;
  update(change: (catalog: Catalog) => Catalog): Promise<Catalog>;
}

/** In-memory catalog, for tests. */
export function memoryCatalogStore(initial: Catalog = defaultCatalog): CatalogStore {
  let catalog = structuredClone(initial);
  return {
    get: async () => structuredClone(catalog),
    update: async change => { catalog = change(structuredClone(catalog)); return structuredClone(catalog); },
  };
}

/** Development-only catalog in .data/catalog.json, starting from the built-in types and attributes. */
export function fileCatalogStore(path: string): CatalogStore {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>) => { const next = queue.then(task, task); queue = next.catch(() => undefined); return next; };
  const read = async (): Promise<Catalog> => {
    const fs = await import("node:fs/promises");
    try { return JSON.parse(await fs.readFile(path, "utf8")) as Catalog; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return structuredClone(defaultCatalog);
    }
  };
  const write = async (catalog: Catalog) => {
    const fs = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(`${path}.tmp`, JSON.stringify(catalog, null, 2));
    await fs.rename(`${path}.tmp`, path);
  };
  return {
    get: () => serial(read),
    update: change => serial(async () => { const next = change(await read()); await write(next); return next; }),
  };
}

type FieldRow = { id: string; label: string; options: string[]; aliases: string[] | null; option_aliases: Record<string, string> | null };
type CategoryRow = { name: string; field_ids: string[]; aliases: string[] | null; element_label: string | null };

async function supabaseCatalogStore(): Promise<CatalogStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The generated Database types do not list these tables until Lovable regenerates them after the migration.
  const db = supabaseAdmin as unknown as SupabaseClient;
  const fail = (error: { message: string }): never => { throw new Error(`[catalog] ${error.message}`); };
  const get = async (): Promise<Catalog> => {
    const [fields, categories] = await Promise.all([db.from("requirement_fields").select("id, label, options, aliases, option_aliases").order("created_at"), db.from("requirement_categories").select("name, field_ids, aliases, element_label").order("created_at")]);
    if (fields.error) fail(fields.error);
    if (categories.error) fail(categories.error);
    const fieldRows = fields.data as FieldRow[];
    const categoryRows = categories.data as CategoryRow[];
    if (!fieldRows.length && !categoryRows.length) return structuredClone(defaultCatalog);
    return {
      fields: fieldRows.map(row => ({ id: row.id, label: row.label, options: row.options, aliases: row.aliases ?? [], optionAliases: row.option_aliases ?? {} })),
      categories: categoryRows.map(row => ({ name: row.name, fieldIds: row.field_ids, aliases: row.aliases ?? [], elementLabel: row.element_label ?? DEFAULT_ELEMENT_LABEL })),
    };
  };
  return {
    get,
    async update(change) {
      const next = change(await get());
      const fields = await db.from("requirement_fields").upsert(next.fields.map(field => ({ id: field.id, label: field.label, options: field.options, aliases: field.aliases ?? [], option_aliases: field.optionAliases ?? {} })));
      if (fields.error) fail(fields.error);
      const categories = await db.from("requirement_categories").upsert(next.categories.map(category => ({ name: category.name, field_ids: category.fieldIds, aliases: category.aliases ?? [], element_label: category.elementLabel ?? DEFAULT_ELEMENT_LABEL })));
      if (categories.error) fail(categories.error);
      return next;
    },
  };
}

let store: Promise<CatalogStore> | undefined;

export function getCatalogStore(): Promise<CatalogStore> {
  store ??= (async () => {
    if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) return supabaseCatalogStore();
    if (process.env["NODE_ENV"] === "production") throw new Error("El catálogo requiere Lovable Cloud configurado.");
    const { resolve } = await import("node:path");
    return fileCatalogStore(resolve(process.cwd(), ".data", "catalog.json"));
  })();
  return store;
}
