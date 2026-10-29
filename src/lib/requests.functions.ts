import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeForSearch } from "./elements";
import { catalogActionSchema } from "./catalog-admin";

const elementSearchSchema = z.object({ category: z.string().trim().min(1).max(80), query: z.string().max(120) });
import { catalogItemDecisionSchema, estimateSchema, requestPackageSchema, reviewerPackageSchema, requestCodeSchema, requestDecisionSchema, requestDelegationSchema, requestUpdateSchema, reviewerDecisionSchema, reviewerSchema } from "./my-requests";

const requester = async () => (await import("./requests.server")).requesterService();
const admin = async () => (await import("./requests.server")).adminService();

// Requester ("Mis solicitudes" and "Nueva solicitud")

export const listMyRequests = createServerFn({ method: "GET" })
  .handler(async () => (await requester()).list());

/** One item creates one request; several create a package of individual requests. */
export const createMyRequests = createServerFn({ method: "POST" })
  .inputValidator(input => requestPackageSchema.parse(input))
  .handler(async ({ data }) => (await requester()).createMany(data));

export const updateMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestUpdateSchema.parse(input))
  .handler(async ({ data }) => (await requester()).update(data.code, data.input));

export const cancelMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestCodeSchema.parse(input))
  .handler(async ({ data }) => (await requester()).cancel(data.code));

// Contract administrator ("Revisar solicitudes")

export const listAllRequests = createServerFn({ method: "GET" })
  .handler(async () => (await admin()).list());

/** Opening a request in "Revisar solicitudes" starts its review (Enviada → En revisión). */
export const startRequestReview = createServerFn({ method: "POST" })
  .inputValidator(input => requestCodeSchema.parse(input))
  .handler(async ({ data }) => (await admin()).startReview(data.code));

export const decideRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestDecisionSchema.parse(input))
  .handler(async ({ data }) => (await admin()).decide(data.code, data.decision, data.reason));

export const delegateRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestDelegationSchema.parse(input))
  .handler(async ({ data }) => (await admin()).delegate(data.code, data.department, data.assigneeName));

// Department reviewer ("Gestión de departamento")

const reviewer = async (department: string, assigneeName: string) => (await import("./requests.server")).reviewerService(department, assigneeName);

export const listReviewerRequests = createServerFn({ method: "GET" })
  .inputValidator(input => reviewerSchema.parse(input))
  .handler(async ({ data }) => (await reviewer(data.department, data.assigneeName)).list());

export const decideAsReviewer = createServerFn({ method: "POST" })
  .inputValidator(input => reviewerDecisionSchema.parse(input))
  .handler(async ({ data }) => (await reviewer(data.reviewer.department, data.reviewer.assigneeName)).decide(data.code, data.decision, data.reason));

/** The rest of a package for a reviewer assigned to one of its requests. */
export const getReviewerPackage = createServerFn({ method: "GET" })
  .inputValidator(input => reviewerPackageSchema.parse(input))
  .handler(async ({ data }) => (await reviewer(data.reviewer.department, data.reviewer.assigneeName)).package(data.parentCode));

/** Estimated resolution date, set by the contract administrator or, with `reviewer`, by the assigned department reviewer. */
export const setEstimatedResolution = createServerFn({ method: "POST" })
  .inputValidator(input => estimateSchema.parse(input))
  .handler(async ({ data }) => data.reviewer
    ? (await reviewer(data.reviewer.department, data.reviewer.assigneeName)).estimate(data.code, data.date)
    : (await admin()).estimate(data.code, data.date));

/** Approves or rejects one novelty in one or several requests (the latter from the Catálogo page). */
export const decideCatalogItems = createServerFn({ method: "POST" })
  .inputValidator(input => catalogItemDecisionSchema.parse(input))
  .handler(async ({ data }) => (await admin()).decideItems(data.targets, data.status, data.edit));

/** The administrator's direct edits on the Catálogo page. */
export const manageCatalog = createServerFn({ method: "POST" })
  .inputValidator(input => catalogActionSchema.parse(input))
  .handler(async ({ data }) => (await admin()).manageCatalog(data));

export const getCatalogReview = createServerFn({ method: "GET" })
  .handler(async () => (await admin()).catalogReview());

// Catalog ("Nueva solicitud" shows only approved types, attributes and options)

/** Element suggestions for the category being written (debounced by the form). */
export const searchElementSuggestions = createServerFn({ method: "GET" })
  .inputValidator(input => elementSearchSchema.parse(input))
  .handler(async ({ data }) => {
    if (normalizeForSearch(data.query).length < 2) return [];
    const { getElementStore } = await import("./element-store.server");
    return (await getElementStore()).search(data.category, data.query);
  });

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
