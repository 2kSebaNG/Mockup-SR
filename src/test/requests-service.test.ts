import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requestFromInput, requestInputSchema, type RequestInput } from "@/lib/my-requests";
import { fileStore } from "@/lib/requests-store.server";
import { createRequestService } from "@/lib/requests.server";

const input: RequestInput = { category: "Personas", quantity: 2, dueDate: "2026-11-20", description: "Soldadores para turno de noche.", fields: [{ label: "Especialidad", value: "Soldador" }, { label: "Unidad", value: "Días" }] };

let dir: string;
let path: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "requests-")); path = join(dir, "requests.json"); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("Request input", () => {
  it("rejects missing category, quantity and date", () => {
    expect(requestInputSchema.safeParse({ ...input, category: " " }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, quantity: 0 }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, quantity: undefined }).success).toBe(false);
    expect(requestInputSchema.safeParse({ ...input, dueDate: "" }).success).toBe(false);
  });
  it("takes the unit from the Unidad field, drops empty fields and assigns the category's authorizer", () => {
    const request = requestFromInput({ ...input, fields: [...input.fields, { label: "Marca", value: "" }] });
    expect(request.unit).toBe("Días");
    expect(request.fields.map(f => f.label)).toEqual(["Especialidad", "Unidad"]);
    expect(request.authorizer.name).toBe("Paula Araya");
  });
});

describe("Request service", () => {
  it("creates a sent request that survives a fresh store on the same file", async () => {
    const service = createRequestService(fileStore(path), "ana@aecon.cl");
    const created = await service.create(input);
    expect(created.request).toMatchObject({ status: "Enviada", category: "Personas", quantity: 2 });
    const reloaded = await createRequestService(fileStore(path), "ana@aecon.cl").list();
    expect(reloaded.map(r => r.code)).toEqual([created.request!.code]);
    expect(await createRequestService(fileStore(path), "otro@aecon.cl").list()).toEqual([]);
  });
  it("gives each new request its own code", async () => {
    const service = createRequestService(fileStore(path), "ana@aecon.cl");
    const [a, b] = await Promise.all([service.create(input), service.create(input)]);
    expect(a.request!.code).not.toBe(b.request!.code);
  });
  it("saves edits only while the request is pending", async () => {
    const service = createRequestService(fileStore(path), "ana@aecon.cl");
    const { request } = await service.create(input);
    const edited = await service.update(request!.code, { ...input, category: "Maquinarias", quantity: 1 });
    expect(edited.request).toMatchObject({ category: "Maquinarias", quantity: 1, status: "Enviada" });
    expect(edited.request!.authorizer.name).toBe("Carlos Fuentes");
    await service.cancel(request!.code);
    const blocked = await service.update(request!.code, input);
    expect(blocked.error).toMatch(/ya no se puede editar/);
  });
  it("cancels once and keeps the cancellation", async () => {
    const service = createRequestService(fileStore(path), "ana@aecon.cl");
    const { request } = await service.create(input);
    expect((await service.cancel(request!.code)).request?.status).toBe("Anulado");
    expect((await service.cancel(request!.code)).error).toMatch(/ya está anulada/);
    expect((await createRequestService(fileStore(path), "ana@aecon.cl").list())[0]?.status).toBe("Anulado");
  });
  it("does not touch another requester's request", async () => {
    const { request } = await createRequestService(fileStore(path), "ana@aecon.cl").create(input);
    expect((await createRequestService(fileStore(path), "otro@aecon.cl").cancel(request!.code)).error).toMatch(/No encontramos/);
  });
});
