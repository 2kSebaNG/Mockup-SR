import { DEMO_REQUESTER, canCancel, canEdit, requestFromInput, type MyRequest, type RequestInput } from "./my-requests";
import { getRequestStore, type RequestStore } from "./requests-store.server";

export type RequestResult = { request: MyRequest; error: null } | { request: null; error: string };

const failure = (error: string): RequestResult => ({ request: null, error });

// The same edit/cancel rules the table uses for its buttons, enforced again here so they hold for any caller.
export function createRequestService(store: RequestStore, requester: string) {
  return {
    list: () => store.list(requester),
    async create(input: RequestInput): Promise<RequestResult> {
      return { request: await store.create(requester, requestFromInput(input)), error: null };
    },
    async update(code: string, input: RequestInput): Promise<RequestResult> {
      const current = await store.get(requester, code);
      if (!current) return failure("No encontramos esa solicitud.");
      if (!canEdit(current.status)) return failure(`La solicitud está ${current.status.toLowerCase()} y ya no se puede editar.`);
      const updated = await store.update(requester, code, requestFromInput(input));
      return updated ? { request: updated, error: null } : failure("No encontramos esa solicitud.");
    },
    async cancel(code: string): Promise<RequestResult> {
      const current = await store.get(requester, code);
      if (!current) return failure("No encontramos esa solicitud.");
      if (!canCancel(current.status)) return failure("La solicitud ya está anulada.");
      const updated = await store.update(requester, code, { status: "Anulado" });
      return updated ? { request: updated, error: null } : failure("No encontramos esa solicitud.");
    },
  };
}

export async function requestService() {
  return createRequestService(await getRequestStore(), DEMO_REQUESTER);
}
