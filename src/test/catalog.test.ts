import { describe, expect, it } from "vitest";
import { applyItem, defaultCatalog, diffAgainstCatalog, fieldsForCategory, findCategory, findField, groupPendingItems, itemKey, pendingSummary, proposalFor, recordDecision, reviewOf, type ProposedField } from "@/lib/catalog";

const drink: ProposedField[] = [
  { label: "Unidad", value: "Litros", options: [] },
  { label: "Tipo de bebestible", value: "Jugo", options: ["Jugo", "Agua", "Gaseosa"] },
  { label: "Marca", value: "Soprole", options: ["Sin preferencia", "Soprole"] },
];

describe("Catalog novelties", () => {
  it("lists each novelty as its own item: the type, a new select and a new option of an existing select", () => {
    const review = reviewOf(defaultCatalog, proposalFor(defaultCatalog, "Bebestible", drink))!;
    expect(review.items.map(item => [item.kind, item.name, item.status])).toEqual([
      ["type", "Bebestible", "pendiente"],
      ["field", "Tipo de bebestible", "pendiente"],
      ["option", "Soprole", "pendiente"],
    ]);
    expect(review.items.find(item => item.kind === "field")?.options).toEqual(["Jugo", "Agua", "Gaseosa"]);
    expect(pendingSummary(review)).toBe("Tipo nuevo · 1 select nuevo · 1 opción nueva");
  });
  it("proposes nothing when a request only uses approved types, selects and options", () => {
    expect(proposalFor(defaultCatalog, "personas", [{ label: "especialidad", value: "Soldador", options: ["Operador", "Soldador"] }])).toBeNull();
  });
  it("asks to associate an existing select used with an existing type", () => {
    const review = reviewOf(defaultCatalog, proposalFor(defaultCatalog, "Personas", [{ label: "Marca", value: "", options: [] }]));
    expect(review?.items).toMatchObject([{ kind: "link", name: "Marca", category: "Personas", status: "pendiente" }]);
  });
  it("keeps the diff the form shows to the requester", () => {
    expect(diffAgainstCatalog(defaultCatalog, "Bebestible", drink)).toMatchObject({ newCategory: true, newFields: [{ label: "Tipo de bebestible" }], newOptions: [{ field: "Marca", options: ["Soprole"] }] });
  });
});

describe("Deciding novelties one by one", () => {
  const start = () => {
    const proposal = proposalFor(defaultCatalog, "Bebestible", drink)!;
    return { proposal, items: reviewOf(defaultCatalog, proposal)!.items };
  };

  it("adds only the approved item, under the corrected name", () => {
    const { proposal, items } = start();
    const option = items.find(item => item.kind === "option")!;
    const catalog = applyItem(defaultCatalog, proposal, option, { as: "Soprole S.A." });
    expect(findField(catalog, "Marca")?.options).toContain("Soprole S.A.");
    expect(findCategory(catalog, "Bebestible")).toBeUndefined();
    const review = reviewOf(catalog, recordDecision(proposal, option, "aprobada", { as: "Soprole S.A." }))!;
    expect(review.items.find(item => item.key === option.key)).toMatchObject({ status: "aprobada", as: "Soprole S.A." });
    expect(review.items.filter(item => item.status === "pendiente").map(item => item.kind)).toEqual(["type", "field"]);
  });
  it("creates a type that keeps the selects approved before and after it", () => {
    let { proposal, items } = start();
    const field = items.find(item => item.kind === "field")!;
    let catalog = applyItem(defaultCatalog, proposal, field, { options: ["Jugo", "Agua", "Té"] });
    proposal = recordDecision(proposal, field, "aprobada", { options: ["Jugo", "Agua", "Té"] });
    const type = reviewOf(catalog, proposal)!.items.find(item => item.kind === "type")!;
    catalog = applyItem(catalog, proposal, type, { as: "Bebidas" });
    expect(fieldsForCategory(catalog, "Bebidas").map(f => f.label)).toEqual(["Unidad", "Tipo de bebestible", "Marca"]);
    expect(findField(catalog, "Tipo de bebestible")?.options).toEqual(["Jugo", "Agua", "Té"]);
    expect(findCategory(defaultCatalog, "Bebidas")).toBeUndefined();
  });
  it("merges into an existing select when the administrator maps the new one to it", () => {
    const proposal = proposalFor(defaultCatalog, "Alimentos", [{ label: "Presentación", value: "Lata", options: ["Lata"] }])!;
    const field = reviewOf(defaultCatalog, proposal)!.items[0]!;
    const catalog = applyItem(defaultCatalog, proposal, field, { as: "Formato" });
    expect(catalog.fields).toHaveLength(defaultCatalog.fields.length);
    expect(findField(catalog, "Formato")?.options).toContain("Lata");
    expect(reviewOf(catalog, recordDecision(proposal, field, "aprobada", { as: "Formato" }))?.items[0]).toMatchObject({ status: "aprobada", as: "Formato" });
  });
  it("remembers corrected names, so other requests using the old one are not asked about again", () => {
    const proposal = proposalFor(defaultCatalog, "Bebestible", [{ label: "Tipo de bebestible", value: "Jugo", options: ["Jugo"] }, { label: "Formato", value: "Tetra", options: [] }])!;
    const items = reviewOf(defaultCatalog, proposal)!.items;
    let catalog = applyItem(defaultCatalog, proposal, items.find(item => item.kind === "type")!, { as: "Bebidas" });
    catalog = applyItem(catalog, proposal, items.find(item => item.kind === "field")!, { as: "Tipo de bebida" });
    catalog = applyItem(catalog, proposal, items.find(item => item.kind === "option")!, { as: "Tetra Pak" });
    const sameAsBefore = proposalFor(catalog, "bebestible", [{ label: "tipo de bebestible", value: "Jugo", options: [] }, { label: "Formato", value: "tetra", options: [] }]);
    expect(sameAsBefore).toBeNull();
    expect(findCategory(catalog, "Bebestible")?.name).toBe("Bebidas");
    expect(findField(catalog, "Formato")?.options).not.toContain("Tetra");
  });
  it("keeps a rejection on the request and out of the catalog", () => {
    const { proposal, items } = start();
    const type = items.find(item => item.kind === "type")!;
    expect(reviewOf(defaultCatalog, recordDecision(proposal, type, "rechazada"))!.items[0]).toMatchObject({ kind: "type", status: "rechazada" });
  });
  it("groups the same pending novelty from several requests so it is decided once", () => {
    const review = reviewOf(defaultCatalog, proposalFor(defaultCatalog, "Bebestible", drink));
    const groups = groupPendingItems([
      { code: "REQ-1", requester: { name: "Ana" }, review },
      { code: "REQ-2", requester: { name: "Luis" }, review },
    ]);
    expect(groups.map(group => [group.kind, group.name, group.requests.length])).toEqual([["type", "Bebestible", 2], ["field", "Tipo de bebestible", 2], ["option", "Soprole", 2]]);
    expect(groups[0]!.targets).toEqual([{ code: "REQ-1", key: itemKey.type() }, { code: "REQ-2", key: itemKey.type() }]);
  });
});
