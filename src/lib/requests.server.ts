import { canCancel, canDecide, canEdit, requestFromInput, statusPhrase, type MyRequest, type RequestInput, type ReviewedRequest } from "./my-requests";
import { applyItem, groupPendingItems, proposalFor, recordDecision, reviewOf, type ItemEdit } from "./catalog";
import { DEMO_USER, findMember, type Person } from "./organization";
import { getCatalogStore, type CatalogStore } from "./catalog-store.server";
import { getRequestStore, type RequestStore } from "./requests-store.server";

export type RequestResult = { request: ReviewedRequest; error: null } | { request: null; error: string };

const failure = (error: string): RequestResult => ({ request: null, error });
const notFound = () => failure("No encontramos esa solicitud.");

// The same rules the tables use for their buttons, enforced again here so they hold for any caller.

/** Attaches to each request how its proposal compares with the catalog as it is now. */
function reviewer(catalogs: CatalogStore) {
  return {
    async one(request: MyRequest | null): Promise<RequestResult> {
      return request ? { request: { ...request, review: reviewOf(await catalogs.get(), request.proposal) }, error: null } : notFound();
    },
    async many(requests: MyRequest[]): Promise<ReviewedRequest[]> {
      const catalog = await catalogs.get();
      return requests.map(request => ({ ...request, review: reviewOf(catalog, request.proposal) }));
    },
  };
}

/**
 * What a requester can do with their own requests. Anything new they used (type, attributes, options) is only kept
 * as a pending proposal on the request; the catalog itself is never changed here.
 */
export function createRequesterService(store: RequestStore, catalogs: CatalogStore, user: Person) {
  const view = reviewer(catalogs);
  const own = async (code: string) => { const request = await store.get(code); return request?.requester.email === user.email ? request : null; };
  const withProposal = async (input: RequestInput) => ({ ...requestFromInput(input), proposal: proposalFor(await catalogs.get(), input.category, input.fields) });
  return {
    list: async () => view.many(await store.list({ requesterEmail: user.email })),
    async create(input: RequestInput): Promise<RequestResult> {
      return view.one(await store.create({ ...(await withProposal(input)), requester: user }));
    },
    async update(code: string, input: RequestInput): Promise<RequestResult> {
      const current = await own(code);
      if (!current) return notFound();
      if (!canEdit(current.status)) return failure(`La solicitud está ${statusPhrase(current.status)} y ya no se puede editar.`);
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
export function createAdminService(store: RequestStore, catalogs: CatalogStore) {
  const view = reviewer(catalogs);
  const pending = async (code: string) => {
    const current = await store.get(code);
    if (!current) return notFound();
    if (!canDecide(current.status)) return failure(`La solicitud ya está ${statusPhrase(current.status)}; solo se gestionan solicitudes enviadas.`);
    return view.one(current);
  };
  return {
    list: async () => view.many(await store.list()),
    get: (code: string) => store.get(code),
    async decide(code: string, decision: "Autorizado" | "Rechazado"): Promise<RequestResult> {
      const check = await pending(code);
      return check.error !== null ? check : view.one(await store.update(code, { status: decision }));
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
      if (!current?.proposal) return current ? failure("Esta solicitud no propone tipos, selects ni opciones nuevas.") : notFound();
      const item = reviewOf(await catalogs.get(), current.proposal)?.items.find(candidate => candidate.key === itemKeyValue);
      if (!item || item.status !== "pendiente") return failure("Eso ya fue decidido o ya está en el catálogo.");
      if (status === "aprobada") await catalogs.update(catalog => applyItem(catalog, current.proposal!, item, edit));
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
    /** Everything still waiting for a decision across all requests, grouped so each novelty is decided once. */
    async catalogReview() {
      const catalog = await catalogs.get();
      return { catalog, groups: groupPendingItems(await view.many(await store.list())) };
    },
  };
}

/** What a department reviewer can do: see the requests delegated to them and decide the ones still in review. */
export function createReviewerService(store: RequestStore, catalogs: CatalogStore, reviewerPerson: Person) {
  const view = reviewer(catalogs);
  const assigned = (request: MyRequest | null) => request?.assignee?.email === reviewerPerson.email ? request : null;
  return {
    list: async () => view.many((await store.list()).filter(request => assigned(request))),
    async decide(code: string, decision: "Autorizado" | "Rechazado"): Promise<RequestResult> {
      const current = assigned(await store.get(code));
      if (!current) return notFound();
      if (current.status !== "En revisión") return failure(`La solicitud ya está ${statusPhrase(current.status)}; solo se deciden solicitudes en revisión.`);
      return view.one(await store.update(code, { status: decision }));
    },
  };
}

export async function reviewerService(department: string, reviewerName: string) {
  // No sign-in yet: the page says which reviewer it acts as, and it must be a real member of that department.
  const person = findMember(department, reviewerName);
  if (!person) throw new Error("Encargado desconocido para ese departamento.");
  return createReviewerService(await getRequestStore(), await getCatalogStore(), person);
}

export async function requesterService() {
  return createRequesterService(await getRequestStore(), await getCatalogStore(), DEMO_USER);
}

export async function adminService() {
  return createAdminService(await getRequestStore(), await getCatalogStore());
}
