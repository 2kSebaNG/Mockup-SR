import { createServerFn } from "@tanstack/react-start";
import { requestCodeSchema, requestInputSchema, requestUpdateSchema } from "./my-requests";

const service = async () => (await import("./requests.server")).requestService();

export const listMyRequests = createServerFn({ method: "GET" })
  .handler(async () => (await service()).list());

export const createMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestInputSchema.parse(input))
  .handler(async ({ data }) => (await service()).create(data));

export const updateMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestUpdateSchema.parse(input))
  .handler(async ({ data }) => (await service()).update(data.code, data.input));

export const cancelMyRequest = createServerFn({ method: "POST" })
  .inputValidator(input => requestCodeSchema.parse(input))
  .handler(async ({ data }) => (await service()).cancel(data.code));
