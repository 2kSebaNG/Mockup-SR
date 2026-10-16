import { categories as baseCategories, fieldPool, type RequirementField } from "./requirements";

/**
 * The approved catalog of request types ("categorías") and their select attributes ("campos").
 * Requesters may invent new types, selects and options in a request; those stay as a pending proposal on the request
 * until the contract administrator approves them one by one (optionally correcting them), and only then are added here.
 */
/**
 * `aliases` / `optionAliases` keep the names a requester used before the administrator corrected them (e.g. "Tetra"
 * approved as "Tetra Pak"), so other requests with the old name are recognized instead of being asked about again.
 */
export type CatalogField = { id: string; label: string; options: string[]; aliases?: string[]; optionAliases?: Record<string, string> };
export type CatalogCategory = { name: string; fieldIds: string[]; aliases?: string[] };
export type Catalog = { categories: CatalogCategory[]; fields: CatalogField[] };

const baseCategoryFields: Record<string, string[]> = {
  Herramientas: ["unidad", "marca", "dimensiones", "alimentacion"],
  Maquinarias: ["unidad", "marca", "capacidad", "alimentacion"],
  Personas: ["unidad", "especialidad"],
  Materiales: ["unidad", "material", "dimensiones"],
  Alimentos: ["unidad", "formato"],
};

export const defaultCatalog: Catalog = {
  categories: baseCategories.map(name => ({ name, fieldIds: baseCategoryFields[name] ?? [] })),
  fields: fieldPool.map(field => ({ ...field, options: [...field.options] })),
};

const key = (value: string) => value.trim().toLocaleLowerCase("es");

/** Unique, trimmed, non-empty values; the first spelling wins when two differ only in case. */
export function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values.map(value => value.trim()).filter(value => value && !seen.has(key(value)) && seen.add(key(value)));
}

const matches = (name: string, aliases: string[] | undefined, wanted: string) => key(name) === key(wanted) || (aliases ?? []).some(alias => key(alias) === key(wanted));

export function findCategory(catalog: Catalog, name: string) {
  return catalog.categories.find(category => matches(category.name, category.aliases, name));
}

export function findField(catalog: Catalog, label: string) {
  return catalog.fields.find(field => matches(field.label, field.aliases, label));
}

/** Whether a select already has this option, directly or as a corrected (aliased) name. */
export function hasOption(field: CatalogField, option: string) {
  return field.options.some(existing => key(existing) === key(option)) || key(option) in (field.optionAliases ?? {});
}

const addAlias = (aliases: string[] | undefined, canonical: string, alias: string) =>
  key(alias) === key(canonical) ? aliases : uniqueValues([...(aliases ?? []), alias]);

export function fieldsForCategory(catalog: Catalog, category: string): RequirementField[] {
  const ids = findCategory(catalog, category)?.fieldIds ?? [];
  return ids.flatMap(id => catalog.fields.filter(field => field.id === id)).map(field => ({ ...field, options: [...field.options], value: "" }));
}

function fieldId(catalog: Catalog, label: string) {
  const base = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campo";
  let id = base;
  for (let n = 2; catalog.fields.some(field => field.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** A select as the requester left it in the form: its label, chosen value and every option it offered. */
export type ProposedField = { label: string; value: string; options: string[] };
export type CatalogDiff = {
  category: string;
  newCategory: boolean;
  /** Attributes to associate with the type (all of them for a new type). */
  links: string[];
  newFields: { label: string; options: string[] }[];
  newOptions: { field: string; options: string[] }[];
};

export function diffAgainstCatalog(catalog: Catalog, category: string, fields: ProposedField[]): CatalogDiff {
  const existingCategory = findCategory(catalog, category);
  const linked = new Set((existingCategory?.fieldIds ?? []).map(id => catalog.fields.find(field => field.id === id)?.label).filter(Boolean).map(label => key(label!)));
  const proposed = fields.filter((field, index) => field.label.trim() && fields.findIndex(other => key(other.label) === key(field.label)) === index);
  const newFields: CatalogDiff["newFields"] = [];
  const newOptions: CatalogDiff["newOptions"] = [];
  for (const field of proposed) {
    const options = uniqueValues([...field.options, field.value]);
    const existing = findField(catalog, field.label);
    if (!existing) { newFields.push({ label: field.label.trim(), options }); continue; }
    const extra = options.filter(option => !hasOption(existing, option));
    if (extra.length) newOptions.push({ field: existing.label, options: extra });
  }
  return {
    category: existingCategory?.name ?? category.trim(),
    newCategory: !existingCategory,
    links: proposed.map(field => findField(catalog, field.label)?.label ?? field.label.trim()).filter(label => !linked.has(key(label))),
    newFields,
    newOptions,
  };
}

export const hasClassificationChanges = (diff: CatalogDiff) => diff.newCategory || diff.newFields.length > 0 || diff.links.length > 0;
export const hasOptionChanges = (diff: CatalogDiff) => diff.newOptions.length > 0;

/**
 * A single novelty a request brings, decided one by one by the contract administrator:
 * - `type`: a request type that is not in the catalog.
 * - `field`: a select that does not exist yet (with the options the requester gave it).
 * - `link`: an existing select used with an existing type it is not associated with yet.
 * - `option`: a new option for an existing select.
 */
export type CatalogItemKind = "type" | "field" | "link" | "option";
export type ItemStatus = "pendiente" | "aprobada" | "rechazada";
/** What was decided, and the name it was saved under when the administrator corrected it or mapped it to an existing one. */
export type ItemDecision = { status: "aprobada" | "rechazada"; as?: string; options?: string[] };

/** What a request proposes for the catalog, kept on the request: the request's own type and selects, plus the decisions so far. */
export type StoredProposal = { category: string; fields: ProposedField[]; decisions: Record<string, ItemDecision> };

export type CatalogItem = {
  key: string;
  kind: CatalogItemKind;
  /** As the requester (or the AI) wrote it. */
  name: string;
  /** Type the item belongs to (already resolved to the approved name, if any). */
  category: string;
  /** For `link` and `option`: the select it belongs to, as written in the request. */
  field?: string;
  /** For `field`: its options. */
  options?: string[];
  status: ItemStatus;
  /** Name it was approved under, when different from `name`. */
  as?: string;
};

export type ProposalReview = { category: string; items: CatalogItem[] };

export const itemKey = {
  type: () => "type",
  field: (label: string) => `field:${key(label)}`,
  link: (label: string) => `link:${key(label)}`,
  option: (field: string, value: string) => `option:${key(field)}:${key(value)}`,
};

const resolvedCategory = (proposal: StoredProposal) => proposal.decisions[itemKey.type()]?.as ?? proposal.category;
const resolvedField = (proposal: StoredProposal, label: string) => proposal.decisions[itemKey.field(label)]?.as ?? label;
const distinctFields = (fields: ProposedField[]) => fields.filter((field, index) => field.label.trim() && fields.findIndex(other => key(other.label) === key(field.label)) === index);

/**
 * Every novelty of a proposal compared with today's catalog. Decided items keep their decision; pending ones that the
 * catalog already has (because another request got them approved) drop out instead of being asked for twice.
 */
export function reviewOf(catalog: Catalog, proposal: StoredProposal | null): ProposalReview | null {
  if (!proposal) return null;
  const decisions = proposal.decisions ?? {};
  const decided = (itemKeyValue: string) => decisions[itemKeyValue];
  const categoryName = resolvedCategory(proposal);
  const category = findCategory(catalog, categoryName);
  const linkedIds = new Set(category?.fieldIds ?? []);
  const items: CatalogItem[] = [];
  const push = (item: Omit<CatalogItem, "status" | "category">, decision: ItemDecision | undefined) =>
    items.push({ ...item, category: category?.name ?? categoryName, status: decision?.status ?? "pendiente", ...(decision?.as && key(decision.as) !== key(item.name) && { as: decision.as }) });

  const typeDecision = decided(itemKey.type());
  if (typeDecision || !category) push({ key: itemKey.type(), kind: "type", name: proposal.category.trim() }, typeDecision);

  for (const field of distinctFields(proposal.fields)) {
    const options = uniqueValues([...field.options, field.value]);
    const fieldDecision = decided(itemKey.field(field.label));
    const existing = findField(catalog, resolvedField(proposal, field.label));
    if (fieldDecision || !existing) {
      push({ key: itemKey.field(field.label), kind: "field", name: field.label.trim(), options: fieldDecision?.options ?? options }, fieldDecision);
      continue;
    }
    // Associating an existing select with an existing type; for a new type the association comes with approving the type.
    const linkDecision = decided(itemKey.link(field.label));
    if (linkDecision || (category && !linkedIds.has(existing.id))) push({ key: itemKey.link(field.label), kind: "link", name: existing.label, field: field.label }, linkDecision);
    for (const option of options) {
      const optionDecision = decided(itemKey.option(field.label, option));
      if (optionDecision || !hasOption(existing, option)) push({ key: itemKey.option(field.label, option), kind: "option", name: option, field: field.label }, optionDecision);
    }
  }
  return items.length ? { category: category?.name ?? categoryName, items } : null;
}

export const pendingItems = (review: ProposalReview | null) => review?.items.filter(item => item.status === "pendiente") ?? [];
export const isPendingReview = (review: ProposalReview | null) => pendingItems(review).length > 0;

/** "Tipo nuevo · 1 select nuevo · 2 opciones nuevas": what is still waiting in a request. */
export function pendingSummary(review: ProposalReview | null) {
  const pending = pendingItems(review);
  const count = (kind: CatalogItemKind) => pending.filter(item => item.kind === kind).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    count("type") > 0 && "Tipo nuevo",
    count("field") > 0 && plural(count("field"), "select nuevo", "selects nuevos"),
    count("link") > 0 && plural(count("link"), "select por asociar", "selects por asociar"),
    count("option") > 0 && plural(count("option"), "opción nueva", "opciones nuevas"),
  ].filter(Boolean).join(" · ");
}

/** The proposal to keep on a request, or null when everything it uses is already in the catalog. */
export function proposalFor(catalog: Catalog, category: string, fields: ProposedField[]): StoredProposal | null {
  const proposal: StoredProposal = { category, fields, decisions: {} };
  return reviewOf(catalog, proposal) ? proposal : null;
}

export type ItemEdit = { as?: string | undefined; options?: string[] | undefined };

const cloneCatalog = (catalog: Catalog): Catalog => structuredClone(catalog);

function link(catalog: Catalog, categoryName: string, fieldLabel: string) {
  const category = findCategory(catalog, categoryName);
  const field = findField(catalog, fieldLabel);
  if (category && field && !category.fieldIds.includes(field.id)) category.fieldIds.push(field.id);
}

/**
 * Adds one approved item to the catalog, under the administrator's corrected name if given. A name that matches an
 * existing type, select or option merges into it, so approving twice (or mapping to an existing one) is harmless.
 */
export function applyItem(catalog: Catalog, proposal: StoredProposal, item: CatalogItem, edit: ItemEdit = {}): Catalog {
  const next = cloneCatalog(catalog);
  const name = edit.as?.trim() || item.name;
  if (item.kind === "type") {
    let category = findCategory(next, name);
    if (!category) { category = { name, fieldIds: [] }; next.categories.push(category); }
    const aliases = addAlias(category.aliases, category.name, item.name);
    if (aliases) category.aliases = aliases;
    for (const field of distinctFields(proposal.fields)) link(next, name, resolvedField(proposal, field.label));
  } else if (item.kind === "field") {
    const options = uniqueValues(edit.options ?? item.options ?? []);
    let field = findField(next, name);
    if (field) field.options = uniqueValues([...field.options, ...options.filter(option => !hasOption(field!, option))]);
    else { field = { id: fieldId(next, name), label: name, options }; next.fields.push(field); }
    const aliases = addAlias(field.aliases, field.label, item.name);
    if (aliases) field.aliases = aliases;
    link(next, resolvedCategory(proposal), name);
  } else if (item.kind === "link") {
    link(next, resolvedCategory(proposal), item.name);
  } else {
    const field = findField(next, resolvedField(proposal, item.field ?? ""));
    if (field) {
      field.options = uniqueValues([...field.options, name]);
      if (key(name) !== key(item.name)) field.optionAliases = { ...field.optionAliases, [key(item.name)]: name };
    }
  }
  return next;
}

/** Records a decision on the proposal (with the corrected name, when it differs). */
export function recordDecision(proposal: StoredProposal, item: CatalogItem, status: "aprobada" | "rechazada", edit: ItemEdit = {}): StoredProposal {
  const as = edit.as?.trim();
  const decision: ItemDecision = { status, ...(status === "aprobada" && as && key(as) !== key(item.name) && { as }), ...(status === "aprobada" && item.kind === "field" && edit.options && { options: uniqueValues(edit.options) }) };
  return { ...proposal, decisions: { ...(proposal.decisions ?? {}), [item.key]: decision } };
}

/** One novelty as several requests propose it, so the administrator decides it once on the Catálogo page. */
export type CatalogGroup = {
  id: string;
  kind: CatalogItemKind;
  name: string;
  category: string;
  field?: string;
  options: string[];
  requests: { code: string; requester: string }[];
  targets: { code: string; key: string }[];
};

export function groupPendingItems(requests: { code: string; requester: { name: string }; review: ProposalReview | null }[]): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const request of requests) {
    for (const item of pendingItems(request.review)) {
      const id = item.kind === "type" ? `type:${key(item.name)}`
        : item.kind === "field" ? `field:${key(item.name)}`
        : item.kind === "link" ? `link:${key(item.category)}:${key(item.name)}`
        : `option:${key(item.field ?? "")}:${key(item.name)}`;
      const group = groups.get(id) ?? { id, kind: item.kind, name: item.name, category: item.category, ...(item.field && { field: item.field }), options: [], requests: [], targets: [] };
      group.options = uniqueValues([...group.options, ...(item.options ?? [])]);
      if (!group.requests.some(r => r.code === request.code)) group.requests.push({ code: request.code, requester: request.requester.name });
      group.targets.push({ code: request.code, key: item.key });
      groups.set(id, group);
    }
  }
  const order: CatalogItemKind[] = ["type", "field", "link", "option"];
  return [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.requests.length - a.requests.length || a.name.localeCompare(b.name, "es"));
}
