import { canCancel, canDecide, canEdit, canEstimate, REJECTION_REASON_MIN, requestFromInput, statusPhrase, todayIso, type MyRequest, type RequestInput, type ReviewedRequest } from "./my-requests";
import { applyItem, elementLookup, findCategory, groupPendingItems, proposalFor, recordDecision, reviewOf, type Catalog, type ItemEdit, type StoredProposal } from "./catalog";
import { ElementEditError, elementKey, getElementStore, memoryElementStore, type ElementStore } from "./element-store.server";
import { applyCatalogAction, CatalogEditError, type CatalogAction } from "./catalog-admin";
import { DEMO_USER, findMember, type Person } from "./organization";
import { getCatalogStore, type CatalogStore } from "./catalog-store.server";
import { getRequestStore, type RequestStore } from "./requests-store.server";

export type RequestResult = { request: ReviewedRequest; error: null } | { request: null; error: string };

const failure = (error: string): RequestResult => ({ request: null, error });
const notFound = () => failure("No encontramos esa solicitud.");

// The same rules the tables use for their buttons, enforced again here so they hold for any caller.

/** A rejection always says why, so the requester knows what to change. */
function decisionPatch(decision: "Autorizado" | "Rechazado", reason?: string): Partial<MyRequest> | string {
  if (decision === "Autorizado") return { status: decision, rejectionReason: null };
  const text = reason?.trim() ?? "";
  return text.length >= REJECTION_REASON_MIN ? { status: decision, rejectionReason: text } : `Escribe la razón del rechazo (al menos ${REJECTION_REASON_MIN} caracteres).`;
}

/** The estimate cannot be earlier than the day the request was created. */
function estimatePatch(request: MyRequest, date: string | null): Partial<MyRequest> | string {
  if (!canEstimate(request.status)) return `La solicitud ya está ${statusPhrase(request.status)}; la fecha estimada solo se asigna mientras espera una decisión.`;
  if (date && date < request.createdAt) return "La fecha estimada no puede ser anterior a la creación de la solicitud.";
  return { estimatedResolution: date };
}

/** Which proposals' elements are already in their category's master catalog. */
async function knownElements(catalog: Catalog, elements: ElementStore, proposals: (StoredProposal | null)[]) {
  const pairs = proposals.map(proposal => elementLookup(catalog, proposal)).filter(pair => pair !== null);
  const found = await elements.resolve(pairs);
  return (category: string, name: string) => found.has(elementKey(category, name));
}

/** Attaches to each request how its proposal compares with the catalog and master catalogs as they are now. */
function reviewer(catalogs: CatalogStore, elements: ElementStore) {
  const many = async (requests: MyRequest[]): Promise<ReviewedRequest[]> => {
    const catalog = await catalogs.get();
    const known = await knownElements(catalog, elements, requests.map(request => request.proposal));
    return requests.map(request => ({ ...request, review: reviewOf(catalog, request.proposal, known) }));
  };
  return {
    async one(request: MyRequest | null): Promise<RequestResult> {
      return request ? { request: (await many([request]))[0]!, error: null } : notFound();
    },
    many,
  };
}

/**
 * What a requester can do with their own requests. Anything new they used (type, attributes, options) is only kept
 * as a pending proposal on the request; the catalog itself is never changed here.
 */
export function createRequesterService(store: RequestStore, catalogs: CatalogStore, user: Person, elements: ElementStore = memoryElementStore()) {
  const view = reviewer(catalogs, elements);
  const own = async (code: string) => { const request = await store.get(code); return request?.requester.email === user.email ? request : null; };
  const withProposal = async (input: RequestInput) => {
    const catalog = await catalogs.get();
    const draft: StoredProposal = { category: input.category, fields: input.fields, element: input.element, decisions: {} };
    const known = await knownElements(catalog, elements, [draft]);
    return { ...requestFromInput(input), proposal: proposalFor(catalog, input.category, input.fields, input.element, known) };
  };
  return {
    list: async () => view.many(await store.list({ requesterEmail: user.email })),
    async create(input: RequestInput): Promise<RequestResult> {
      if (input.dueDate < todayIso()) return failure("La fecha de vencimiento no puede ser anterior a hoy.");
      return view.one(await store.create({ ...(await withProposal(input)), requester: user }));
    },
    async update(code: string, input: RequestInput): Promise<RequestResult> {
      const current = await own(code);
      if (!current) return notFound();
      if (!canEdit(current.status)) return failure(`La solicitud está ${statusPhrase(current.status)} y ya no se puede editar.`);
      if (input.dueDate !== current.dueDate && input.dueDate < todayIso()) return failure("La fecha de vencimiento no puede ser anterior a hoy.");
      return view.one(await store.update(code, await withProposal(input)));
    },
    async cancel(code: string): Promise<RequestResult> {
      const current = await own(code);
      if (!current) return notFound();
      if (!canCancel(current.status)) return failure("La solicitud ya está anulada.");
      return view.one(await store.update(code, { status: "Anulado" }));
    },
  };
}

/** What the contract administrator can do: see every request, decide or delegate the ones still waiting, and approve proposed catalog novelties. */
export function createAdminService(store: RequestStore, catalogs: CatalogStore, elements: ElementStore = memoryElementStore()) {
  const view = reviewer(catalogs, elements);
  const pending = async (code: string) => {
    const current = await store.get(code);
    if (!current) return notFound();
    if (!canDecide(current.status)) return failure(`La solicitud ya está ${statusPhrase(current.status)}; solo se gestionan solicitudes enviadas.`);
    return view.one(current);
  };
  return {
    list: async () => view.many(await store.list()),
    get: (code: string) => store.get(code),
    async decide(code: string, decision: "Autorizado" | "Rechazado", reason?: string): Promise<RequestResult> {
      const check = await pending(code);
      if (check.error !== null) return check;
      const patch = decisionPatch(decision, reason);
      return typeof patch === "string" ? failure(patch) : view.one(await store.update(code, patch));
    },
    /** Any request still waiting (sent or in review), so the administrator can set it before or after delegating. */
    async estimate(code: string, date: string | null): Promise<RequestResult> {
      const current = await store.get(code);
      if (!current) return notFound();
      const patch = estimatePatch(current, date);
      return typeof patch === "string" ? failure(patch) : view.one(await store.update(code, patch));
    },
    async delegate(code: string, department: string, assigneeName: string): Promise<RequestResult> {
      const assignee = findMember(department, assigneeName);
      if (!assignee) return failure("Elige un encargado del departamento seleccionado.");
      const check = await pending(code);
      return check.error !== null ? check : view.one(await store.update(code, { status: "En revisión", department, assignee }));
    },
    /**
     * Approves or rejects one novelty of a request (a new type, select, association or option), independently of the
     * request's own status. Approval may correct the name, or map it to an existing one, and adjust a new select's
     * options. Only approved items reach the catalog; rejected ones stay on the request for the record.
     */
    async decideItem(code: string, itemKeyValue: string, status: "aprobada" | "rechazada", edit: ItemEdit = {}): Promise<RequestResult> {
      const current = await store.get(code);
      if (!current?.proposal) return current ? failure("Esta solicitud no propone categorías, atributos ni opciones nuevas.") : notFound();
      const catalog = await catalogs.get();
      const item = reviewOf(catalog, current.proposal, await knownElements(catalog, elements, [current.proposal]))?.items.find(candidate => candidate.key === itemKeyValue);
      if (!item || item.status !== "pendiente") return failure("Eso ya fue decidido o ya está en el catálogo.");
      if (status === "aprobada" && item.kind === "element") {
        // An element is filed in its category's master catalog, so the category has to exist first.
        const category = findCategory(catalog, item.category);
        if (!category) return failure(`Primero aprueba la categoría «${item.category}»; el elemento se guarda en su catálogo maestro.`);
        await elements.add(category.name, edit.as?.trim() || item.name, item.name);
      } else if (status === "aprobada") {
        await catalogs.update(next => applyItem(next, current.proposal!, item, edit));
      }
      return view.one(await store.update(code, { proposal: recordDecision(current.proposal, item, status, edit) }));
    },
    /**
     * The same decision for the same novelty proposed by several requests (from the Catálogo page). Requests whose
     * item stopped being pending meanwhile (e.g. the first approval already added it) are skipped.
     */
    async decideItems(targets: { code: string; key: string }[], status: "aprobada" | "rechazada", edit: ItemEdit = {}) {
      const results: RequestResult[] = [];
      for (const target of targets) results.push(await this.decideItem(target.code, target.key, status, edit));
      const decided = results.filter(result => result.request !== null).length;
      return decided ? { decided, error: null } : { decided, error: results[0]?.error ?? "No hay nada pendiente que decidir." };
    },
    /**
     * Direct edits from the Catálogo page: categories, their element label and master catalog, selects and options.
     * Returns a message instead of throwing when the edit is not possible (duplicate name, already deleted…).
     */
    async manageCatalog(action: CatalogAction): Promise<{ error: string | null }> {
      try {
        if (action.action === "element.add" || action.action === "element.rename" || action.action === "element.delete") {
          const category = findCategory(await catalogs.get(), action.category);
          if (!category) return { error: `No existe la categoría «${action.category}».` };
          if (action.action === "element.add") {
            if ((await elements.resolve([{ category: category.name, name: action.name }])).size) return { error: `«${action.name}» ya está en el catálogo maestro de ${category.name}.` };
            await elements.add(category.name, action.name.trim());
          } else if (action.action === "element.rename") await elements.rename(category.name, action.name, action.to);
          else await elements.remove(category.name, action.name);
          return { error: null };
        }
        const before = action.action === "category.rename" || action.action === "category.delete" ? findCategory(await catalogs.get(), action.name)?.name : undefined;
        await catalogs.update(catalog => applyCatalogAction(catalog, action));
        if (action.action === "category.rename" && before) await elements.renameCategory(before, action.to.trim());
        if (action.action === "category.delete" && before) await elements.removeCategory(before);
        return { error: null };
      } catch (error) {
        if (error instanceof CatalogEditError || error instanceof ElementEditError) return { error: error.message };
        throw error;
      }
    },
    /** Everything still waiting for a decision across all requests, grouped so each novelty is decided once. */
    async catalogReview() {
      const catalog = await catalogs.get();
      return { catalog, masters: await elements.all(), groups: groupPendingItems(await view.many(await store.list())) };
    },
  };
}

/** What a department reviewer can do: see the requests delegated to them and decide the ones still in review. */
export function createReviewerService(store: RequestStore, catalogs: CatalogStore, reviewerPerson: Person, elements: ElementStore = memoryElementStore()) {
  const view = reviewer(catalogs, elements);
  const assigned = (request: MyRequest | null) => request?.assignee?.email === reviewerPerson.email ? request : null;
  return {
    list: async () => view.many((await store.list()).filter(request => assigned(request))),
    async decide(code: string, decision: "Autorizado" | "Rechazado", reason?: string): Promise<RequestResult> {
      const current = assigned(await store.get(code));
      if (!current) return notFound();
      if (current.status !== "En revisión") return failure(`La solicitud ya está ${statusPhrase(current.status)}; solo se deciden solicitudes en revisión.`);
      const patch = decisionPatch(decision, reason);
      return typeof patch === "string" ? failure(patch) : view.one(await store.update(code, patch));
    },
    async estimate(code: string, date: string | null): Promise<RequestResult> {
      const current = assigned(await store.get(code));
      if (!current) return notFound();
      const patch = estimatePatch(current, date);
      return typeof patch === "string" ? failure(patch) : view.one(await store.update(code, patch));
    },
  };
}

export async function reviewerService(department: string, reviewerName: string) {
  // No sign-in yet: the page says which reviewer it acts as, and it must be a real member of that department.
  const person = findMember(department, reviewerName);
  if (!person) throw new Error("Encargado desconocido para ese departamento.");
  return createReviewerService(await getRequestStore(), await getCatalogStore(), person, await getElementStore());
}

export async function requesterService() {
  return createRequesterService(await getRequestStore(), await getCatalogStore(), DEMO_USER, await getElementStore());
}

export async function adminService() {
  return createAdminService(await getRequestStore(), await getCatalogStore(), await getElementStore());
}
