import { z } from "zod";

export type RequirementField = { id: string; label: string; options: string[]; value: string };
export const categories = ["Herramientas", "Maquinarias", "Personas", "Materiales", "Alimentos"];
export const fieldPool = [
  { id: "unidad", label: "Unidad", options: ["Unidades", "Litros", "Kilogramos", "Metros", "Horas", "Días"] },
  { id: "marca", label: "Marca", options: ["Sin preferencia", "Bosch", "Makita", "DeWalt", "Caterpillar"] },
  { id: "dimensiones", label: "Dimensiones", options: ["Pequeño", "Mediano", "Grande"] },
  { id: "material", label: "Material", options: ["Acero", "Madera", "Plástico", "Aluminio"] },
  { id: "especialidad", label: "Especialidad", options: ["Operador", "Electricista", "Soldador", "Ayudante"] },
  { id: "capacidad", label: "Capacidad", options: ["5 toneladas", "10 toneladas", "20 toneladas"] },
  { id: "alimentacion", label: "Alimentación", options: ["Eléctrica", "Batería", "Diésel", "Manual"] },
  { id: "formato", label: "Formato", options: ["Individual", "Caja", "Bolsa", "Botella"] },
];
const categoryFields: Record<string, string[]> = {
  Herramientas: ["unidad", "marca", "dimensiones", "alimentacion"],
  Maquinarias: ["unidad", "marca", "capacidad", "alimentacion"],
  Personas: ["unidad", "especialidad"],
  Materiales: ["unidad", "material", "dimensiones"],
  Alimentos: ["unidad", "formato"],
};
export function fieldsForCategory(category: string): RequirementField[] {
  return fieldPool.filter(f => categoryFields[category]?.includes(f.id)).map(f => ({ ...f, options: [...f.options], value: "" }));
}
export const aiInputSchema = z.object({
  description: z.string().trim().min(10, "Describe tu requerimiento con al menos 10 caracteres.").max(4000),
  category: z.string().max(80),
  fields: z.array(z.object({ id: z.string().max(80), label: z.string().max(80), options: z.array(z.string().max(100)).max(30), value: z.string().max(100) })).max(16),
});
export const aiOutputSchema = z.object({
  category: z.string(),
  quantity: z.number().nullable(),
  requiredDate: z.string().nullable(),
  fields: z.array(z.object({ label: z.string(), options: z.array(z.string()), value: z.string() })),
});
export type AiRequirement = z.infer<typeof aiOutputSchema>;
export function normalizeAiRequirement(input: AiRequirement): AiRequirement {
  return {
    category: input.category.trim().slice(0, 80),
    quantity: input.quantity !== null && input.quantity > 0 && input.quantity <= 1000000 ? input.quantity : null,
    requiredDate: input.requiredDate && /^\d{4}-\d{2}-\d{2}$/.test(input.requiredDate) && !Number.isNaN(Date.parse(input.requiredDate)) ? input.requiredDate : null,
    fields: input.fields.slice(0, 12).map(f => ({ label: f.label.trim().slice(0, 80), options: [...new Set([...f.options, f.value].map(v => v.trim().slice(0, 100)).filter(Boolean))].slice(0, 30), value: f.value.trim().slice(0, 100) })).filter(f => f.label),
  };
}