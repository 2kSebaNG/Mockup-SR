import { describe, expect, it } from "vitest";
import { applyCatalogAction, CatalogEditError } from "@/lib/catalog-admin";
import { defaultCatalog, fieldsForCategory, findCategory, findField, proposalFor, reviewOf } from "@/lib/catalog";
import { memoryCatalogStore } from "@/lib/catalog-store.server";
import { memoryElementStore } from "@/lib/element-store.server";
import { createAdminService } from "@/lib/requests.server";
import { fileStore } from "@/lib/requests-store.server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Catalog edits", () => {
  it("renames a category and keeps the old name working for existing requests", () => {
    const catalog = applyCatalogAction(defaultCatalog, { action: "category.rename", name: "Personas", to: "Personal" });
    expect(findCategory(catalog, "Personas")?.name).toBe("Personal");
    expect(reviewOf(catalog, proposalFor(catalog, "Personas", [{ label: "Especialidad", value: "Soldador", options: [] }]))).toBeNull();
  });
  it("refuses names that already exist, ignoring case", () => {
    expect(() => applyCatalogAction(defaultCatalog, { action: "category.create", name: "personas", elementLabel: "Cargo" })).toThrow(CatalogEditError);
    expect(() => applyCatalogAction(defaultCatalog, { action: "field.rename", id: "marca", label: "unidad" })).toThrow(/Ya existe el atributo/);
    expect(() => applyCatalogAction(defaultCatalog, { action: "option.add", id: "marca", option: "bosch" })).toThrow(/ya es una opción/);
  });
  it("creates an attribute linked to several categories, or to none", () => {
    const catalog = applyCatalogAction(defaultCatalog, { action: "field.create", label: "Color", options: ["Rojo", "Azul"], categories: ["EPP", "vehículos", "EPP"] });
    expect(fieldsForCategory(catalog, "EPP").filter(f => f.label === "Color")).toHaveLength(1);
    expect(fieldsForCategory(catalog, "Vehículos").map(f => f.label)).toContain("Color");
    const shared = applyCatalogAction(defaultCatalog, { action: "field.create", label: "Color", options: ["Rojo"], categories: [] });
    expect(shared.categories.some(category => category.fieldIds.includes("color"))).toBe(false);
    expect(() => applyCatalogAction(defaultCatalog, { action: "field.create", label: "Color", options: ["Rojo"], categories: ["Inexistente"] })).toThrow(/No existe la categoría/);
  });
  it("creates an attribute inside a category and lets it be unlinked, relinked and deleted everywhere", () => {
    let catalog = applyCatalogAction(defaultCatalog, { action: "field.create", label: "Talla", options: ["S", "M", "L", "M"], categories: ["EPP"] });
    expect(findField(catalog, "Talla")).toMatchObject({ id: "talla", options: ["S", "M", "L"] });
    expect(fieldsForCategory(catalog, "EPP").map(f => f.label)).toContain("Talla");
    catalog = applyCatalogAction(catalog, { action: "field.unlink", id: "talla", category: "EPP" });
    expect(fieldsForCategory(catalog, "EPP").map(f => f.label)).not.toContain("Talla");
    catalog = applyCatalogAction(catalog, { action: "field.link", id: "talla", category: "Personas" });
    catalog = applyCatalogAction(catalog, { action: "field.delete", id: "talla" });
    expect(findField(catalog, "Talla")).toBeUndefined();
    expect(catalog.categories.every(category => !category.fieldIds.includes("talla"))).toBe(true);
  });
  it("changes the element label and removes options", () => {
    let catalog = applyCatalogAction(defaultCatalog, { action: "category.label", name: "Servicios", label: "Servicio requerido" });
    expect(findCategory(catalog, "Servicios")?.elementLabel).toBe("Servicio requerido");
    catalog = applyCatalogAction(catalog, { action: "option.delete", id: "marca", option: "makita" });
    expect(findField(catalog, "Marca")?.options).not.toContain("Makita");
  });
  it("does not change the catalog it was given", () => {
    applyCatalogAction(defaultCatalog, { action: "category.delete", name: "Alimentos" });
    expect(findCategory(defaultCatalog, "Alimentos")).toBeDefined();
  });
});

describe("Managing master catalogs from the Catálogo page", () => {
  const admin = async () => {
    const dir = await mkdtemp(join(tmpdir(), "catalog-admin-"));
    const catalogs = memoryCatalogStore();
    const elements = memoryElementStore();
    return { service: createAdminService(fileStore(join(dir, "requests.json"), () => []), catalogs, elements), catalogs, elements, cleanup: () => rm(dir, { recursive: true, force: true }) };
  };

  it("adds, renames (keeping an alias) and deletes elements, reporting duplicates", async () => {
    const { service, elements, cleanup } = await admin();
    expect((await service.manageCatalog({ action: "element.add", category: "personas", name: "Pañolero" })).error).toBeNull();
    expect((await service.manageCatalog({ action: "element.add", category: "Personas", name: "soldador" })).error).toMatch(/ya está en el catálogo maestro/);
    expect((await service.manageCatalog({ action: "element.rename", category: "Personas", name: "Pañolero", to: "Encargado de pañol" })).error).toBeNull();
    expect(await elements.search("Personas", "pañol")).toContain("Encargado de pañol");
    expect((await elements.resolve([{ category: "Personas", name: "pañolero" }])).size).toBe(1);
    expect((await service.manageCatalog({ action: "element.rename", category: "Personas", name: "Rigger", to: "Soldador" })).error).toMatch(/Ya existe/);
    await service.manageCatalog({ action: "element.delete", category: "Personas", name: "Rigger" });
    expect(await elements.search("Personas", "rigger")).toEqual([]);
    await cleanup();
  });
  it("moves a category's master catalog when it is renamed and drops it when the category is deleted", async () => {
    const { service, catalogs, elements, cleanup } = await admin();
    await service.manageCatalog({ action: "category.rename", name: "Vehículos", to: "Flota" });
    expect((await elements.search("Flota", "camioneta"))[0]).toBe("Camioneta 4x4");
    expect(findCategory(await catalogs.get(), "Vehículos")?.name).toBe("Flota");
    await service.manageCatalog({ action: "category.delete", name: "Flota" });
    expect(findCategory(await catalogs.get(), "Flota")).toBeUndefined();
    expect(Object.keys(await elements.all())).not.toContain("Flota");
    expect((await service.manageCatalog({ action: "element.add", category: "Flota", name: "Bus" })).error).toMatch(/No existe la categoría/);
    await cleanup();
  });
});
