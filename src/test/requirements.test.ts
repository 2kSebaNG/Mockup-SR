import { describe, expect, it } from "vitest";
import { fieldsForCategory, aiInputSchema, normalizeAiRequirement } from "@/lib/requirements";

describe("Requirement description", () => {
  it("uses distinct fields for each category", () => {
    expect(fieldsForCategory("Personas").map(f => f.id)).toContain("especialidad");
    expect(fieldsForCategory("Herramientas").map(f => f.id)).not.toContain("especialidad");
    expect(fieldsForCategory("Personalizada")).toEqual([]);
  });
  it("rejects too-short AI descriptions", () => {
    expect(aiInputSchema.safeParse({ description: "abc", items: [] }).success).toBe(false);
  });
  it("keeps a generated value selectable and rejects invalid quantities", () => {
    const result = normalizeAiRequirement({ requiredDate: "invalid", items: [{ category: " Bebestible ", quantity: -1, fields: [{ label: "Marca", options: ["Soprole", "Soprole"], value: "Watts" }] }] });
    expect(result.items[0]?.category).toBe("Bebestible");
    expect(result.items[0]?.quantity).toBeNull();
    expect(result.requiredDate).toBeNull();
    expect(result.items[0]?.fields[0]?.options).toEqual(["Soprole", "Watts"]);
  });
  it("keeps one item per element asked for, up to ten, and drops items without a category", () => {
    const item = (category: string) => ({ category, element: "Soldador", quantity: 2, fields: [] });
    const result = normalizeAiRequirement({ requiredDate: "2026-11-02", items: [item("Personas"), item("  "), ...Array.from({ length: 12 }, () => item("Maquinarias"))] });
    expect(result.items).toHaveLength(10);
    expect(result.items[0]?.category).toBe("Personas");
    expect(result.items.every(entry => entry.category)).toBe(true);
    expect(result.requiredDate).toBe("2026-11-02");
  });
});
