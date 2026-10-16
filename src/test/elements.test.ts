import { describe, expect, it } from "vitest";
import { defaultCatalog, elementLabelFor } from "@/lib/catalog";
import { defaultElements, elementScore, searchElements, similarity, trigrams } from "@/lib/elements";

const machines = defaultElements["Maquinarias"]!;
const people = defaultElements["Personas"]!;

describe("Trigram search (local equivalent of pg_trgm)", () => {
  it("builds pg_trgm-style trigrams with padded words", () => {
    expect([...trigrams("Grúa")]).toEqual(["  g", " gr", "gru", "rua", "ua "]);
    expect(similarity("grua", "Grúa")).toBe(1);
  });
  it("suggests while typing the beginning of a word", () => {
    expect(searchElements(machines, "ret")[0]).toBe("Retroexcavadora");
    expect(searchElements(people, "sold")).toEqual(["Soldador"]);
  });
  it("tolerates typos and missing accents", () => {
    expect(searchElements(machines, "gura horqilla")[0]).toBe("Grúa horquilla");
    expect(searchElements(people, "electrisista")).toContain("Electricista");
  });
  it("matches any word of a longer name", () => {
    expect(searchElements(people, "grua")).toContain("Operador de grúa");
    expect(elementScore("riesgos", "Prevencionista de riesgos")).toBeGreaterThan(0.5);
  });
  it("suggests nothing for unrelated text", () => {
    expect(searchElements(machines, "zzzz")).toEqual([]);
  });
});

describe("Categories and their element field", () => {
  it("names the element input after each category", () => {
    expect(elementLabelFor(defaultCatalog, "Personas")).toBe("Cargo");
    expect(elementLabelFor(defaultCatalog, "Maquinarias")).toBe("Tipo de máquina");
    expect(elementLabelFor(defaultCatalog, "epp")).toBe("Elemento de protección");
    expect(elementLabelFor(defaultCatalog, "Bebestible")).toBe("Tipo de elemento");
  });
  it("gives every category a starting master catalog", () => {
    for (const category of defaultCatalog.categories) expect(defaultElements[category.name]?.length ?? 0).toBeGreaterThan(4);
  });
});
