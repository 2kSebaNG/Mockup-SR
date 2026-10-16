export type Person = { name: string; role: string; email: string };
export type Department = { name: string; members: Person[] };

// No sign-in exists yet: the header account is the requester and Pablo is the contract administrator (ADC).
export const DEMO_USER: Person = { name: "Sebastián Núñez", role: "Solicitante", email: "snunez@aecon.cl" };
export const CONTRACT_ADMIN: Person = { name: "Pablo Contreras", role: "Administrador de Contrato", email: "pcontreras@aecon.cl" };
export const requesters: Person[] = [
  DEMO_USER,
  { name: "Vladimir Peña", role: "Supervisor de Terreno", email: "vpena@aecon.cl" },
  { name: "Carlos Fuentes", role: "Capataz", email: "cfuentes@aecon.cl" },
];

/** Departments that review delegated requests; the first member is the head and default reviewer. */
export const departments: Department[] = [
  { name: "Abastecimiento", members: [{ name: "Andrés Molina", role: "Jefe de Abastecimiento", email: "amolina@aecon.cl" }, { name: "Camila Torres", role: "Compradora", email: "ctorres@aecon.cl" }] },
  { name: "Bodega", members: [{ name: "Jorge Muñoz", role: "Jefe de Bodega", email: "jmunoz@aecon.cl" }, { name: "Felipe Rivas", role: "Bodeguero", email: "frivas@aecon.cl" }] },
  { name: "Logística", members: [{ name: "Rodrigo Silva", role: "Jefe de Logística", email: "rsilva@aecon.cl" }, { name: "Ignacio Pérez", role: "Coordinador de Transporte", email: "iperez@aecon.cl" }] },
  { name: "Recursos Humanos", members: [{ name: "Maridel Rojas", role: "Jefa de Recursos Humanos", email: "mrojas@aecon.cl" }, { name: "Paula Araya", role: "Analista de Personas", email: "paraya@aecon.cl" }] },
  { name: "Oficina Técnica", members: [{ name: "Daniela Vera", role: "Jefa de Oficina Técnica", email: "dvera@aecon.cl" }] },
  { name: "Seguridad", members: [{ name: "Patricio León", role: "Prevencionista de Riesgos", email: "pleon@aecon.cl" }] },
  { name: "Finanzas", members: [{ name: "Francisca Díaz", role: "Jefa de Finanzas", email: "fdiaz@aecon.cl" }] },
];

export function findDepartment(name: string) {
  return departments.find(department => department.name === name);
}

export function findMember(departmentName: string, memberName: string) {
  return findDepartment(departmentName)?.members.find(member => member.name === memberName);
}

const departmentByCategory: Record<string, string> = {
  Herramientas: "Bodega",
  Maquinarias: "Logística",
  Materiales: "Abastecimiento",
  Personas: "Recursos Humanos",
  Alimentos: "Abastecimiento",
  EPP: "Bodega",
  Servicios: "Abastecimiento",
  Vehículos: "Logística",
  "Combustibles y lubricantes": "Logística",
};

/** Rule-based delegation used when the AI is unavailable: category owner, or procurement for anything new. */
export function delegationByRules(category: string) {
  const department = findDepartment(departmentByCategory[category] ?? "Abastecimiento")!;
  return { department: department.name, assignee: department.members[0]! };
}
