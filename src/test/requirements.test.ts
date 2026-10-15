import { describe, expect, it } from "vitest";
import { fieldsForCategory, aiInputSchema, normalizeAiRequirement } from "@/lib/requirements";

describe("Requirement description", () => {
  it("uses distinct fields for each category", () => {
    expect(fieldsForCategory("Personas").map(f => f.id)).toContain("especialidad");
    expect(fieldsForCategory("Herramientas").map(f => f.id)).not.toContain("especialidad");
    expect(fieldsForCategory("Personalizada")).toEqual([]);
  });
  it("rejects too-short AI descriptions", () => {
    expect(aiInputSchema.safeParse({ description: "abc", category: "", fields: [] }).success).toBe(false);
  });
  it("keeps a generated value selectable and rejects invalid quantities", () => {
    const result = normalizeAiRequirement({ category: " Bebestible ", quantity: -1, requiredDate: "invalid", fields: [{ label: "Marca", options: ["Soprole", "Soprole"], value: "Watts" }] });
    expect(result.category).toBe("Bebestible");
    expect(result.quantity).toBeNull();
    expect(result.requiredDate).toBeNull();
    expect(result.fields[0]?.options).toEqual(["Soprole", "Watts"]);
  });
});