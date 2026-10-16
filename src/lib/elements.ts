/**
 * Master catalogs ("catálogos maestros"): the element types each category offers when writing a request, e.g. the
 * "Cargo" of a Personas request or the "Tipo de máquina" of a Maquinarias one. Suggestions are found by trigram
 * similarity: pg_trgm in Lovable Cloud, and the same algorithm below for local development.
 */

export const DEFAULT_ELEMENT_LABEL = "Tipo de elemento";

/** What the element input is called in each category. Categories without an entry use "Tipo de elemento". */
export const elementLabels: Record<string, string> = {
  Herramientas: "Tipo de herramienta",
  Maquinarias: "Tipo de máquina",
  Personas: "Cargo",
  Materiales: "Tipo de material",
  Alimentos: "Producto",
  EPP: "Elemento de protección",
  Servicios: "Tipo de servicio",
  Vehículos: "Tipo de vehículo",
  "Combustibles y lubricantes": "Producto",
};

/** Initial master catalog of each category; new elements are only added once the contract administrator approves them. */
export const defaultElements: Record<string, string[]> = {
  Herramientas: ["Taladro percutor", "Esmeril angular", "Llave de impacto", "Sierra circular", "Martillo demoledor", "Atornillador inalámbrico", "Nivel láser", "Rotomartillo", "Soldadora inverter", "Tecle de cadena", "Llave de torque", "Caja de herramientas"],
  Maquinarias: ["Grúa horquilla", "Retroexcavadora", "Excavadora", "Camión pluma", "Minicargador", "Generador eléctrico", "Compresor de aire", "Rodillo compactador", "Manipulador telescópico", "Plataforma elevadora", "Grúa móvil", "Motoniveladora"],
  Personas: ["Soldador", "Electricista", "Operador de grúa", "Rigger", "Ayudante", "Capataz", "Prevencionista de riesgos", "Topógrafo", "Supervisor de terreno", "Mecánico", "Maestro albañil", "Operador de maquinaria"],
  Materiales: ["Perfil de acero", "Plancha de acero", "Cemento", "Arena", "Grava", "Tubería HDPE", "Cable eléctrico", "Perno", "Tornillo", "Pintura epóxica", "Madera pino", "Malla acma"],
  Alimentos: ["Colación", "Agua purificada", "Café", "Fruta", "Pan", "Snack", "Jugo"],
  EPP: ["Casco de seguridad", "Guantes de cabritilla", "Lentes de seguridad", "Zapatos de seguridad", "Arnés de seguridad", "Protector auditivo", "Chaleco reflectante", "Respirador con filtro", "Careta de soldar", "Ropa ignífuga"],
  Servicios: ["Transporte de personal", "Arriendo de baños químicos", "Retiro de residuos", "Calibración de equipos", "Mantención de maquinaria", "Servicio de alimentación", "Aseo industrial", "Arriendo de contenedor"],
  Vehículos: ["Camioneta 4x4", "Furgón", "Bus", "Minibús", "Camión aljibe", "Camión tolva", "Camión rampla", "Automóvil"],
  "Combustibles y lubricantes": ["Diésel", "Gasolina 93", "Gasolina 95", "Aceite hidráulico", "Aceite de motor", "Grasa", "Refrigerante", "Líquido de frenos"],
};

/** Lowercase without accents, like `lower(unaccent(...))` in the database. */
export function normalizeForSearch(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** pg_trgm trigrams: each word padded with two spaces before and one after, then every 3-character slice. */
export function trigrams(value: string) {
  const set = new Set<string>();
  for (const word of normalizeForSearch(value).split(/[^a-z0-9ñ]+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / (a.size + b.size - shared);
}

/** pg_trgm `similarity(a, b)`. */
export function similarity(a: string, b: string) {
  return overlap(trigrams(a), trigrams(b));
}

/** Close to pg_trgm `word_similarity(query, text)`: the best match between the query and any run of words in the text. */
export function wordSimilarity(query: string, text: string) {
  const words = normalizeForSearch(text).split(" ").filter(Boolean);
  const wanted = trigrams(query);
  let best = 0;
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) best = Math.max(best, overlap(wanted, trigrams(words.slice(start, end).join(" "))));
  }
  return best;
}

/** Ranking used for suggestions; names containing what was typed rank first, so typing feels like autocomplete. */
export function elementScore(query: string, name: string) {
  const q = normalizeForSearch(query);
  const n = normalizeForSearch(name);
  if (!q) return 0;
  const contained = n.includes(q) ? 0.6 + 0.4 * (q.length / n.length) : 0;
  return Math.max(contained, similarity(q, n), wordSimilarity(q, n));
}

export const SUGGESTION_THRESHOLD = 0.3;
export const SUGGESTION_LIMIT = 8;

export function searchElements(names: string[], query: string, limit = SUGGESTION_LIMIT) {
  return names
    .map(name => ({ name, score: elementScore(query, name) }))
    .filter(match => match.score >= SUGGESTION_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"))
    .slice(0, limit)
    .map(match => match.name);
}
