import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requestFromInput, requestInputSchema, responsibleFor, reviewerSchema, type RequestInput } from "@/lib/my-requests";
import { CONTRACT_ADMIN, delegationByRules, findMember, requesters, type Person } from "@/lib/organization";
import { fileStore } from "@/lib/requests-store.server";
import { createAdminService, createRequesterService, createReviewerService } from "@/lib/requests.server";

const input: RequestInput = { category: "Personas", quantity: 2, dueDate: "2026-11-20", description: "Soldadores para turno de noche.", fields: [{ label: "Especialidad", value: "Soldador" }, { label: "Unidad", value: "Días" }], aiAssisted: false };
const ana: Person = { name: "Ana Soto", role: "Solicitante", email: "ana@aecon.cl" };
const otro: Person = { name: "Otro Usuario", role: "Solicitante", email: "otro@aecon.cl" };

let dir: string;
let path: string;
// Start every test from an empty store instead of the development seed.
const store = () => fileStore(path, () => []);
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "requests-")); path = join(dir, "requests.json"); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("Request input", () => {
  it("rejects missing category, quantity and date", () => {
    expect(requestInputSchema.safeParse({ ...input, category: " " }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, quantity: 0 }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, quantity: undefined }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, dueDate: "" }).success).toBe(false);
  });
  it("takes the unit from the Unidad field, drops empty fields and keeps AI assistance only with a description", () => {
    const request = requestFromInput({ ...input, aiAssisted: true, fields: [...input.fields, { label: "Marca", value: "" }] });
    expect(request.unit).toBe("Días");
    expect(request.fields.map(f => f.label)).toEqual(["Especialidad", "Unidad"]);
    expect(request.aiAssisted).toBe(true);
    expect(requestFromInput({ ...input, aiAssisted: true, description: "" }).aiAssisted).toBe(false);
  });
});

describe("Requester service", () => {
  it("creates a sent, unassigned request that survives a fresh store on the same file", async () => {
    const created = await createRequesterService(store(), ana).create(input);
    expect(created.request).toMatchObject({ status: "Enviada", category: "Personas", quantity: 2, department: null, assignee: null, requester: ana });
    expect(responsibleFor(created.request!)).toEqual(CONTRACT_ADMIN);
    expect((await createRequesterService(store(), ana).list()).map(r => r.code)).toEqual([created.request!.code]);
    expect(await createRequesterService(store(), otro).list()).toEqual([]);
  });
  it("gives each new request its own code", async () => {
    const service = createRequesterService(store(), ana);
    const [a, b] = await Promise.all([service.create(input), service.create(input)]);
    expect(a.request!.code).not.toBe(b.request!.code);
  });
  it("saves edits only while the request is pending", async () => {
    const service = createRequesterService(store(), ana);
    const { request } = await service.create(input);
    expect((await service.update(request!.code, { ...input, category: "Maquinarias", quantity: 1 })).request).toMatchObject({ category: "Maquinarias", quantity: 1, status: "Enviada" });
    await service.cancel(request!.code);
    expect((await service.update(request!.code, input)).error).toMatch(/ya no se puede editar/);
  });
  it("cancels once and keeps the cancellation", async () => {
    const service = createRequesterService(store(), ana);
    const { request } = await service.create(input);
    expect((await service.cancel(request!.code)).request?.status).toBe("Anulado");
    expect((await service.cancel(request!.code)).error).toMatch(/ya está anulada/);
    expect((await createRequesterService(store(), ana).list())[0]?.status).toBe("Anulado");
  });
  it("does not touch another requester's request", async () => {
    const { request } = await createRequesterService(store(), ana).create(input);
    expect((await createRequesterService(store(), otro).cancel(request!.code)).error).toMatch(/No encontramos/);
  });
});

describe("Contract administrator service", () => {
  it("sees every requester's requests", async () => {
    await createRequesterService(store(), ana).create(input);
    await createRequesterService(store(), otro).create(input);
    expect((await createAdminService(store()).list()).map(r => r.requester.email).sort()).toEqual(["ana@aecon.cl", "otro@aecon.cl"]);
  });
  it("authorizes or rejects a pending request only once", async () => {
    const { request } = await createRequesterService(store(), ana).create(input);
    const admin = createAdminService(store());
    expect((await admin.decide(request!.code, "Autorizado")).request?.status).toBe("Autorizado");
    expect((await admin.decide(request!.code, "Rechazado")).error).toMatch(/solo se gestionan solicitudes enviadas/);
  });
  it("delegates to a department member, which puts the request in review and makes that person responsible", async () => {
    const { request } = await createRequesterService(store(), ana).create(input);
    const delegated = await createAdminService(store()).delegate(request!.code, "Recursos Humanos", "Paula Araya");
    expect(delegated.request).toMatchObject({ status: "En revisión", department: "Recursos Humanos", assignee: { name: "Paula Araya" } });
    expect(responsibleFor(delegated.request!).name).toBe("Paula Araya");
    expect((await createAdminService(store()).decide(request!.code, "Autorizado")).error).toMatch(/en revisión/);
  });
  it("refuses a reviewer from another department and leaves the request pending", async () => {
    const { request } = await createRequesterService(store(), ana).create(input);
    const admin = createAdminService(store());
    expect((await admin.delegate(request!.code, "Bodega", "Paula Araya")).error).toMatch(/encargado del departamento/);
    expect((await admin.get(request!.code))?.status).toBe("Enviada");
  });
  it("does not act on cancelled requests", async () => {
    const service = createRequesterService(store(), ana);
    const { request } = await service.create(input);
    await service.cancel(request!.code);
    expect((await createAdminService(store()).delegate(request!.code, "Bodega", "Jorge Muñoz")).error).toMatch(/ya está anulada/);
  });
});

describe("Department reviewer service", () => {
  const paula = findMember("Recursos Humanos", "Paula Araya")!;
  const maridel = findMember("Recursos Humanos", "Maridel Rojas")!;
  const delegated = async (to = "Paula Araya") => {
    const { request } = await createRequesterService(store(), ana).create(input);
    await createAdminService(store()).delegate(request!.code, "Recursos Humanos", to);
    return request!.code;
  };

  it("lists only the requests delegated to that reviewer", async () => {
    const code = await delegated();
    await createRequesterService(store(), ana).create(input);
    expect((await createReviewerService(store(), paula).list()).map(r => r.code)).toEqual([code]);
    expect(await createReviewerService(store(), maridel).list()).toEqual([]);
  });
  it("authorizes or rejects a request in review once, and the requester sees the decision", async () => {
    const code = await delegated();
    const reviewer = createReviewerService(store(), paula);
    expect((await reviewer.decide(code, "Rechazado")).request).toMatchObject({ status: "Rechazado", assignee: { name: "Paula Araya" } });
    expect((await reviewer.decide(code, "Autorizado")).error).toBe("La solicitud ya está rechazada; solo se deciden solicitudes en revisión.");
    const mine = (await createRequesterService(store(), ana).list())[0]!;
    expect(mine.status).toBe("Rechazado");
    expect(responsibleFor(mine).name).toBe("Paula Araya");
  });
  it("does not let another reviewer decide, nor decide requests that were not delegated", async () => {
    const code = await delegated();
    expect((await createReviewerService(store(), maridel).decide(code, "Autorizado")).error).toMatch(/No encontramos/);
    const { request } = await createRequesterService(store(), ana).create(input);
    expect((await createReviewerService(store(), paula).decide(request!.code, "Autorizado")).error).toMatch(/No encontramos/);
  });
  it("does not decide a request the requester cancelled while in review", async () => {
    const code = await delegated();
    await createRequesterService(store(), ana).cancel(code);
    expect((await createReviewerService(store(), paula).decide(code, "Autorizado")).error).toMatch(/ya está anulada/);
  });
  it("refuses a reviewer that is not part of the department", () => {
    expect(reviewerSchema.safeParse({ department: "Bodega", assigneeName: "Paula Araya" }).success).toBe(false);
    expect(reviewerSchema.safeParse({ department: "Recursos Humanos", assigneeName: "Paula Araya" }).success).toBe(true);
  });
});

describe("Delegation rules", () => {
  it("routes each category to its department head and anything new to procurement", () => {
    expect(delegationByRules("Personas")).toMatchObject({ department: "Recursos Humanos", assignee: { name: "Maridel Rojas" } });
    expect(delegationByRules("Herramientas").department).toBe("Bodega");
    expect(delegationByRules("Bebestible").department).toBe("Abastecimiento");
    expect(requesters.length).toBeGreaterThan(1);
  });
});
