import { createServerFn } from "@tanstack/react-start";
import { catalogItemDecisionSchema, requestCodeSchema, requestDecisionSchema, requestDelegationSchema, requestInputSchema, requestUpdateSchema, reviewerDecisionSchema, reviewerSchema } from "./my-requests";

const requester = async () => (await import("./requests.server")).requesterService();
const admin = async () => (await import("./requests.server")).adminService();

// Requester ("Mis solicitudes" and "Nueva solicitud")

export const listMyRequests = createServerFn({ method: "GET" })
  .handler(async () => (await requester()).list());

export const createMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestInputSchema.parse(input))
  .handler(async ({ data }) => (await requester()).create(data));

export const updateMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestUpdateSchema.parse(input))
  .handler(async ({ data }) => (await requester()).update(data.code, data.input));

export const cancelMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestCodeSchema.parse(input))
  .handler(async ({ data }) => (await requester()).cancel(data.code));

// Contract administrator ("Gestionar solicitudes")

export const listAllRequests = createServerFn({ method: "GET" })
  .handler(async () => (await admin()).list());

export const decideRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestDecisionSchema.parse(input))
  .handler(async ({ data }) => (await admin()).decide(data.code, data.decision));

export const delegateRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestDelegationSchema.parse(input))
  .handler(async ({ data }) => (await admin()).delegate(data.code, data.department, data.assigneeName));

// Department reviewer ("Revisión del departamento")

const reviewer = async (department: string, assigneeName: string) => (await import("./requests.server")).reviewerService(department, assigneeName);

export const listReviewerRequests = createServerFn({ method: "GET" })
  .inputValidator(input => reviewerSchema.parse(input))
  .handler(async ({ data }) => (await reviewer(data.department, data.assigneeName)).list());

export const decideAsReviewer = createServerFn({ method: "POST" })
  .inputValidator(input => reviewerDecisionSchema.parse(input))
  .handler(async ({ data }) => (await reviewer(data.reviewer.department, data.reviewer.assigneeName)).decide(data.code, data.decision));

/** Approves or rejects one novelty in one or several requests (the latter from the Catálogo page). */
export const decideCatalogItems = createServerFn({ method: "POST" })
  .inputValidator(input => catalogItemDecisionSchema.parse(input))
  .handler(async ({ data }) => (await admin()).decideItems(data.targets, data.status, data.edit));

export const getCatalogReview = createServerFn({ method: "GET" })
  .handler(async () => (await admin()).catalogReview());

// Catalog ("Nueva solicitud" shows only approved types, attributes and options)

export const getCatalog = createServerFn({ method: "GET" })
  .handler(async () => (await (await import("./catalog-store.server")).getCatalogStore()).get());

export const suggestRequestDelegation = createServerFn({ method: "POST" })
  .inputValidator(input => requestCodeSchema.parse(input))
  .handler(async ({ data }) => {
    const request = await (await admin()).get(data.code);
    if (!request) return { suggestion: null, error: "No encontramos esa solicitud." };
    const { suggestDelegation } = await import("./delegation-ai.server");
    return { suggestion: await suggestDelegation(request), error: null };
  });
