import { canCancel, canDecide, canEdit, requestFromInput, type MyRequest, type RequestInput } from "./my-requests";
import { DEMO_USER, findMember, type Person } from "./organization";
import { getRequestStore, type RequestStore } from "./requests-store.server";

export type RequestResult = { request: MyRequest; error: null } | { request: null; error: string };

const failure = (error: string): RequestResult => ({ request: null, error });
const notFound = () => failure("No encontramos esa solicitud.");
const saved = (request: MyRequest | null): RequestResult => request ? { request, error: null } : notFound();

// The same rules the tables use for their buttons, enforced again here so they hold for any caller.

/** What a requester can do with their own requests. */
export function createRequesterService(store: RequestStore, user: Person) {
  const own = async (code: string) => { const request = await store.get(code); return request?.requester.email === user.email ? request : null; };
  return {
    list: () => store.list({ requesterEmail: user.email }),
    async create(input: RequestInput): Promise<RequestResult> {
      return { request: await store.create({ ...requestFromInput(input), requester: user }), error: null };
    },
    async update(code: string, input: RequestInput): Promise<RequestResult> {
      const current = await own(code);
      if (!current) return notFound();
      if (!canEdit(current.status)) return failure(`La solicitud está ${current.status.toLowerCase()} y ya no se puede editar.`);
      return saved(await store.update(code, requestFromInput(input)));
    },
    async cancel(code: string): Promise<RequestResult> {
      const current = await own(code);
      if (!current) return notFound();
      if (!canCancel(current.status)) return failure("La solicitud ya está anulada.");
      return saved(await store.update(code, { status: "Anulado" }));
    },
  };
}

/** What the contract administrator can do: see every request and decide or delegate the ones still waiting. */
export function createAdminService(store: RequestStore) {
  const pending = async (code: string) => {
    const current = await store.get(code);
    if (!current) return notFound();
    if (!canDecide(current.status)) return failure(`La solicitud ya está ${current.status.toLowerCase()}; solo se gestionan solicitudes enviadas.`);
    return { request: current, error: null } as RequestResult;
  };
  return {
    list: () => store.list(),
    get: (code: string) => store.get(code),
    async decide(code: string, decision: "Autorizado" | "Rechazado"): Promise<RequestResult> {
      const check = await pending(code);
      return check.error !== null ? check : saved(await store.update(code, { status: decision }));
    },
    async delegate(code: string, department: string, assigneeName: string): Promise<RequestResult> {
      const assignee = findMember(department, assigneeName);
      if (!assignee) return failure("Elige un encargado del departamento seleccionado.");
      const check = await pending(code);
      return check.error !== null ? check : saved(await store.update(code, { status: "En revisión", department, assignee }));
    },
  };
}

export async function requesterService() {
  return createRequesterService(await getRequestStore(), DEMO_USER);
}

export async function adminService() {
  return createAdminService(await getRequestStore());
}
