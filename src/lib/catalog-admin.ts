import { z } from "zod";
import { findCategory, findField, uniqueValues, type Catalog } from "./catalog";
import { DEFAULT_ELEMENT_LABEL } from "./elements";

/**
 * Direct edits the contract administrator makes on the Catálogo page. Renames keep the old name as an alias, so
 * existing requests and future ones that use it still map to the right category, select or option. Deleting only
 * affects what is offered from now on: requests keep the values they were written with.
 */

const name = z.string().trim().min(1, "Escribe un nombre.").max(80);
const element = z.string().trim().min(2, "Escribe un nombre de al menos 2 caracteres.").max(120);
const option = z.string().trim().min(1, "Escribe la opción.").max(100);
const fieldId = z.string().min(1).max(80);

export const catalogActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("category.create"), name, elementLabel: name }),
  z.object({ action: z.literal("category.rename"), name, to: name }),
  z.object({ action: z.literal("category.label"), name, label: name }),
  z.object({ action: z.literal("category.delete"), name }),
  z.object({ action: z.literal("element.add"), category: name, name: element }),
  z.object({ action: z.literal("element.rename"), category: name, name: element, to: element }),
  z.object({ action: z.literal("element.delete"), category: name, name: element }),
  z.object({ action: z.literal("field.create"), label: name, options: z.array(option).min(1, "Agrega al menos una opción.").max(30), category: name.optional() }),
  z.object({ action: z.literal("field.rename"), id: fieldId, label: name }),
  z.object({ action: z.literal("field.delete"), id: fieldId }),
  z.object({ action: z.literal("field.link"), id: fieldId, category: name }),
  z.object({ action: z.literal("field.unlink"), id: fieldId, category: name }),
  z.object({ action: z.literal("option.add"), id: fieldId, option }),
  z.object({ action: z.literal("option.delete"), id: fieldId, option }),
]);
export type CatalogAction = z.infer<typeof catalogActionSchema>;

/** A rejected edit, with a message meant for the administrator. */
export class CatalogEditError extends Error {}

const same = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
const clone = (catalog: Catalog): Catalog => structuredClone(catalog);

function category(catalog: Catalog, wanted: string) {
  const found = findCategory(catalog, wanted);
  if (!found) throw new CatalogEditError(`No existe la categoría «${wanted}».`);
  return found;
}

function field(catalog: Catalog, id: string) {
  const found = catalog.fields.find(entry => entry.id === id);
  if (!found) throw new CatalogEditError("Ese select ya no existe.");
  return found;
}

function newFieldId(catalog: Catalog, label: string) {
  const base = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campo";
  let id = base;
  for (let n = 2; catalog.fields.some(entry => entry.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** Applies one catalog edit (master-catalog elements are handled by the element store). */
export function applyCatalogAction(current: Catalog, action: CatalogAction): Catalog {
  const catalog = clone(current);
  switch (action.action) {
    case "category.create": {
      if (findCategory(catalog, action.name)) throw new CatalogEditError(`Ya existe la categoría «${action.name}».`);
      catalog.categories.push({ name: action.name.trim(), fieldIds: [], elementLabel: action.elementLabel.trim() || DEFAULT_ELEMENT_LABEL });
      return catalog;
    }
    case "category.rename": {
      const target = category(catalog, action.name);
      const clash = findCategory(catalog, action.to);
      if (clash && clash !== target) throw new CatalogEditError(`Ya existe la categoría «${clash.name}».`);
      target.aliases = uniqueValues([...(target.aliases ?? []), target.name]).filter(alias => !same(alias, action.to));
      target.name = action.to.trim();
      return catalog;
    }
    case "category.label":
      category(catalog, action.name).elementLabel = action.label.trim();
      return catalog;
    case "category.delete": {
      const target = category(catalog, action.name);
      catalog.categories = catalog.categories.filter(entry => entry !== target);
      return catalog;
    }
    case "field.create": {
      if (findField(catalog, action.label)) throw new CatalogEditError(`Ya existe el select «${action.label}»; agrégalo desde la lista de selects existentes.`);
      const id = newFieldId(catalog, action.label);
      catalog.fields.push({ id, label: action.label.trim(), options: uniqueValues(action.options) });
      if (action.category) category(catalog, action.category).fieldIds.push(id);
      return catalog;
    }
    case "field.rename": {
      const target = field(catalog, action.id);
      const clash = findField(catalog, action.label);
      if (clash && clash !== target) throw new CatalogEditError(`Ya existe el select «${clash.label}».`);
      target.aliases = uniqueValues([...(target.aliases ?? []), target.label]).filter(alias => !same(alias, action.label));
      target.label = action.label.trim();
      return catalog;
    }
    case "field.delete": {
      field(catalog, action.id);
      catalog.fields = catalog.fields.filter(entry => entry.id !== action.id);
      for (const entry of catalog.categories) entry.fieldIds = entry.fieldIds.filter(id => id !== action.id);
      return catalog;
    }
    case "field.link": {
      field(catalog, action.id);
      const target = category(catalog, action.category);
      if (!target.fieldIds.includes(action.id)) target.fieldIds.push(action.id);
      return catalog;
    }
    case "field.unlink": {
      const target = category(catalog, action.category);
      target.fieldIds = target.fieldIds.filter(id => id !== action.id);
      return catalog;
    }
    case "option.add": {
      const target = field(catalog, action.id);
      if (target.options.some(existing => same(existing, action.option))) throw new CatalogEditError(`«${action.option}» ya es una opción de ${target.label}.`);
      target.options.push(action.option.trim());
      return catalog;
    }
    case "option.delete": {
      const target = field(catalog, action.id);
      target.options = target.options.filter(existing => !same(existing, action.option));
      // A deleted option should not keep resolving through an alias either.
      target.optionAliases = Object.fromEntries(Object.entries(target.optionAliases ?? {}).filter(([, canonical]) => !same(canonical, action.option)));
      return catalog;
    }
    default:
      return catalog;
  }
}
