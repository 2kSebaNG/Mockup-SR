import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requestFromInput, requestInputSchema, responsibleFor, reviewerSchema, type RequestInput } from "@/lib/my-requests";
import { CONTRACT_ADMIN, delegationByRules, findMember, requesters, type Person } from "@/lib/organization";
import { fileStore } from "@/lib/requests-store.server";
import { memoryCatalogStore, type CatalogStore } from "@/lib/catalog-store.server";
import { fieldsForCategory, findCategory, findField } from "@/lib/catalog";
import { createAdminService, createRequesterService, createReviewerService } from "@/lib/requests.server";

const input: RequestInput = { category: "Personas", quantity: 2, dueDate: "2026-11-20", description: "Soldadores para turno de noche.", fields: [{ label: "Especialidad", value: "Soldador", options: [] }, { label: "Unidad", value: "Días", options: [] }], aiAssisted: false };
const ana: Person = { name: "Ana Soto", role: "Solicitante", email: "ana@aecon.cl" };
const otro: Person = { name: "Otro Usuario", role: "Solicitante", email: "otro@aecon.cl" };

let dir: string;
let path: string;
// Start every test from an empty store instead of the development seed.
const store = () => fileStore(path, () => []);
let catalogs: CatalogStore;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "requests-")); path = join(dir, "requests.json"); catalogs = memoryCatalogStore(); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("Request input", () => {
  it("rejects missing category, quantity and date", () => {
    expect(requestInputSchema.safeParse({ ...input, category: " " }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, quantity: 0 }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, quantity: undefined }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, dueDate: "" }).success).toBe(false);
  });
  it("takes the unit from the Unidad field, drops empty fields and keeps AI assistance only with a description", () => {
    const request = requestFromInput({ ...input, aiAssisted: true, fields: [...input.fields, { label: "Marca", value: "", options: [] }] });
    expect(request.unit).toBe("Días");
    expect(request.fields.map(f => f.label)).toEqual(["Especialidad", "Unidad"]);
    expect(request.aiAssisted).toBe(true);
    expect(requestFromInput({ ...input, aiAssisted: true, description: "" }).aiAssisted).toBe(false);
  });
});

describe("Requester service", () => {
  it("creates a sent, unassigned request that survives a fresh store on the same file", async () => {
    const created = await createRequesterService(store(), catalogs, ana).create(input);
    expect(created.request).toMatchObject({ status: "Enviada", category: "Personas", quantity: 2, department: null, assignee: null, requester: ana });
    expect(responsibleFor(created.request!)).toEqual(CONTRACT_ADMIN);
    expect((await createRequesterService(store(), catalogs, ana).list()).map(r => r.code)).toEqual([created.request!.code]);
    expect(await createRequesterService(store(), catalogs, otro).list()).toEqual([]);
  });
  it("gives each new request its own code", async () => {
    const service = createRequesterService(store(), catalogs, ana);
    const [a, b] = await Promise.all([service.create(input), service.create(input)]);
    expect(a.request!.code).not.toBe(b.request!.code);
  });
  it("saves edits only while the request is pending", async () => {
    const service = createRequesterService(store(), catalogs, ana);
    const { request } = await service.create(input);
    expect((await service.update(request!.code, { ...input, category: "Maquinarias", quantity: 1 })).request).toMatchObject({ category: "Maquinarias", quantity: 1, status: "Enviada" });
    await service.cancel(request!.code);
    expect((await service.update(request!.code, input)).error).toMatch(/ya no se puede editar/);
  });
  it("cancels once and keeps the cancellation", async () => {
    const service = createRequesterService(store(), catalogs, ana);
    const { request } = await service.create(input);
    expect((await service.cancel(request!.code)).request?.status).toBe("Anulado");
    expect((await service.cancel(request!.code)).error).toMatch(/ya está anulada/);
    expect((await createRequesterService(store(), catalogs, ana).list())[0]?.status).toBe("Anulado");
  });
  it("does not touch another requester's request", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(input);
    expect((await createRequesterService(store(), catalogs, otro).cancel(request!.code)).error).toMatch(/No encontramos/);
  });
});

describe("Contract administrator service", () => {
  it("sees every requester's requests", async () => {
    await createRequesterService(store(), catalogs, ana).create(input);
    await createRequesterService(store(), catalogs, otro).create(input);
    expect((await createAdminService(store(), catalogs).list()).map(r => r.requester.email).sort()).toEqual(["ana@aecon.cl", "otro@aecon.cl"]);
  });
  it("authorizes or rejects a pending request only once", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(input);
    const admin = createAdminService(store(), catalogs);
    expect((await admin.decide(request!.code, "Autorizado")).request?.status).toBe("Autorizado");
    expect((await admin.decide(request!.code, "Rechazado")).error).toMatch(/solo se gestionan solicitudes enviadas/);
  });
  it("delegates to a department member, which puts the request in review and makes that person responsible", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(input);
    const delegated = await createAdminService(store(), catalogs).delegate(request!.code, "Recursos Humanos", "Paula Araya");
    expect(delegated.request).toMatchObject({ status: "En revisión", department: "Recursos Humanos", assignee: { name: "Paula Araya" } });
    expect(responsibleFor(delegated.request!).name).toBe("Paula Araya");
    expect((await createAdminService(store(), catalogs).decide(request!.code, "Autorizado")).error).toMatch(/en revisión/);
  });
  it("refuses a reviewer from another department and leaves the request pending", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(input);
    const admin = createAdminService(store(), catalogs);
    expect((await admin.delegate(request!.code, "Bodega", "Paula Araya")).error).toMatch(/encargado del departamento/);
    expect((await admin.get(request!.code))?.status).toBe("Enviada");
  });
  it("does not act on cancelled requests", async () => {
    const service = createRequesterService(store(), catalogs, ana);
    const { request } = await service.create(input);
    await service.cancel(request!.code);
    expect((await createAdminService(store(), catalogs).delegate(request!.code, "Bodega", "Jorge Muñoz")).error).toMatch(/ya está anulada/);
  });
});

describe("Catalog approval", () => {
  const drink: RequestInput = { ...input, category: "Bebestible", fields: [{ label: "Tipo de bebestible", value: "Jugo", options: ["Jugo", "Agua"] }, { label: "Formato", value: "Tetra", options: ["Botella", "Tetra"] }] };
  const keyOf = (request: { review: { items: { kind: string; key: string }[] } | null }, kind: string) => request.review!.items.find(item => item.kind === kind)!.key;

  it("keeps each novelty pending on the request without touching the catalog", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(drink);
    expect(request!.review!.items.map(item => [item.kind, item.name, item.status])).toEqual([["type", "Bebestible", "pendiente"], ["field", "Tipo de bebestible", "pendiente"], ["option", "Tetra", "pendiente"]]);
    const catalog = await catalogs.get();
    expect(findCategory(catalog, "Bebestible")).toBeUndefined();
    expect(findField(catalog, "Tipo de bebestible")).toBeUndefined();
    expect(findField(catalog, "Formato")?.options).not.toContain("Tetra");
  });
  it("adds each item only when approved, with the administrator's corrections", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(drink);
    const admin = createAdminService(store(), catalogs);
    const code = request!.code;
    await admin.decideItems([{ code, key: keyOf(request!, "option") }], "aprobada", { as: "Tetra Pak" });
    await admin.decideItems([{ code, key: keyOf(request!, "field") }], "aprobada", { options: ["Jugo", "Agua", "Té"] });
    expect(findCategory(await catalogs.get(), "Bebestible")).toBeUndefined();
    await admin.decideItems([{ code, key: keyOf(request!, "type") }], "aprobada", { as: "Bebidas" });
    const catalog = await catalogs.get();
    expect(fieldsForCategory(catalog, "Bebidas").map(f => f.label)).toEqual(["Tipo de bebestible", "Formato"]);
    expect(findField(catalog, "Tipo de bebestible")?.options).toEqual(["Jugo", "Agua", "Té"]);
    expect(findField(catalog, "Formato")?.options).toContain("Tetra Pak");
    const reviewed = (await admin.list()).find(r => r.code === code)!;
    expect(reviewed.review!.items.map(item => [item.kind, item.status, item.as])).toEqual([["type", "aprobada", "Bebidas"], ["field", "aprobada", undefined], ["option", "aprobada", "Tetra Pak"]]);
  });
  it("keeps a rejected item out of the catalog and refuses deciding it twice", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(drink);
    const admin = createAdminService(store(), catalogs);
    const target = [{ code: request!.code, key: keyOf(request!, "type") }];
    expect((await admin.decideItems(target, "rechazada")).decided).toBe(1);
    expect(findCategory(await catalogs.get(), "Bebestible")).toBeUndefined();
    expect((await admin.decideItems(target, "aprobada")).error).toMatch(/ya fue decidido/);
  });
  it("decides the same novelty for several requests at once from the catalog page", async () => {
    await createRequesterService(store(), catalogs, ana).create(drink);
    await createRequesterService(store(), catalogs, otro).create(drink);
    const admin = createAdminService(store(), catalogs);
    const typeGroup = (await admin.catalogReview()).groups.find(group => group.kind === "type")!;
    expect(typeGroup.requests).toHaveLength(2);
    expect((await admin.decideItems(typeGroup.targets, "aprobada")).decided).toBeGreaterThan(0);
    expect((await admin.catalogReview()).groups.some(group => group.kind === "type")).toBe(false);
    expect(findCategory(await catalogs.get(), "Bebestible")).toBeDefined();
  });
  it("refuses a decision for a request that proposes nothing new", async () => {
    const { request } = await createRequesterService(store(), catalogs, ana).create({ ...input, fields: [{ label: "Especialidad", value: "Soldador", options: [] }] });
    expect(request!.proposal).toBeNull();
    expect((await createAdminService(store(), catalogs).decideItems([{ code: request!.code, key: "type" }], "aprobada")).error).toMatch(/no propone/);
  });
});

describe("Department reviewer service", () => {
  const paula = findMember("Recursos Humanos", "Paula Araya")!;
  const maridel = findMember("Recursos Humanos", "Maridel Rojas")!;
  const delegated = async (to = "Paula Araya") => {
    const { request } = await createRequesterService(store(), catalogs, ana).create(input);
    await createAdminService(store(), catalogs).delegate(request!.code, "Recursos Humanos", to);
    return request!.code;
  };

  it("lists only the requests delegated to that reviewer", async () => {
    const code = await delegated();
    await createRequesterService(store(), catalogs, ana).create(input);
    expect((await createReviewerService(store(), catalogs, paula).list()).map(r => r.code)).toEqual([code]);
    expect(await createReviewerService(store(), catalogs, maridel).list()).toEqual([]);
  });
  it("authorizes or rejects a request in review once, and the requester sees the decision", async () => {
    const code = await delegated();
    const reviewer = createReviewerService(store(), catalogs, paula);
    expect((await reviewer.decide(code, "Rechazado")).request).toMatchObject({ status: "Rechazado", assignee: { name: "Paula Araya" } });
    expect((await reviewer.decide(code, "Autorizado")).error).toBe("La solicitud ya está rechazada; solo se deciden solicitudes en revisión.");
    const mine = (await createRequesterService(store(), catalogs, ana).list())[0]!;
    expect(mine.status).toBe("Rechazado");
    expect(responsibleFor(mine).name).toBe("Paula Araya");
  });
  it("does not let another reviewer decide, nor decide requests that were not delegated", async () => {
    const code = await delegated();
    expect((await createReviewerService(store(), catalogs, maridel).decide(code, "Autorizado")).error).toMatch(/No encontramos/);
    const { request } = await createRequesterService(store(), catalogs, ana).create(input);
    expect((await createReviewerService(store(), catalogs, paula).decide(request!.code, "Autorizado")).error).toMatch(/No encontramos/);
  });
  it("does not decide a request the requester cancelled while in review", async () => {
    const code = await delegated();
    await createRequesterService(store(), catalogs, ana).cancel(code);
    expect((await createReviewerService(store(), catalogs, paula).decide(code, "Autorizado")).error).toMatch(/ya está anulada/);
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
