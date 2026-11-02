import type { PermissionCode } from "@/lib/access";

// The Abastecimiento module (budget-control-web) in the sidebar: the four groups of its old top bar — Reporte,
// Abastecimiento (here "Compras", so it does not repeat the module's name), Negocios and Administración — as sections
// of one module. Sidebar, breadcrumbs and the pages still being built all read this, so a view is declared once.
// docs/plan-abastecimiento.md has the phases.

export type ProcurementPath =
  | "/abastecimiento/reporte"
  | "/abastecimiento/ordenes-compra" | "/abastecimiento/ordenes-compra/aprobacion" | "/abastecimiento/caja-chica"
  | "/abastecimiento/plan" | "/abastecimiento/remuneraciones"
  | "/abastecimiento/negocios" | "/abastecimiento/proyectos" | "/abastecimiento/ventas" | "/abastecimiento/escenarios"
  | "/abastecimiento/vencimientos"
  | "/abastecimiento/admin/unidades" | "/abastecimiento/admin/cuentas" | "/abastecimiento/admin/proveedores"
  | "/abastecimiento/admin/clientes" | "/abastecimiento/admin/empresa" | "/abastecimiento/admin/impuestos"
  | "/abastecimiento/admin/usuarios";

export type ProcurementView = {
  title: string;
  to: ProcurementPath;
  /** What the API asks for to read it; the menu hides what the session cannot open. */
  permission: PermissionCode;
  /** One sentence of what the page is for, shown under its title. */
  description: string;
  /** What the view will hold, while it is being built. */
  scope?: string[];
  /** The phase of the plan that brings it. */
  phase?: 1 | 2 | 3 | 4;
  /** Its source in budget-control-web. */
  source?: string;
};

export type ProcurementSection = { title: string; views: ProcurementView[] };

export const MODULE = "Abastecimiento";

export const reportView: ProcurementView = {
  title: "Reporte", to: "/abastecimiento/reporte", permission: "forecast:read", phase: 4, source: "/report",
  description: "Los proyectos activos con sus indicadores, y el detalle de cada uno con su proyección, presupuesto y plan.",
  scope: ["Portafolio con los indicadores de cada proyecto y modo concentración", "Proyecto: grilla mensual con la proyección editable, alertas y escenarios", "Pestañas Presupuesto (P0–P3) y Plan de abastecimiento"],
};

export const procurementSections: ProcurementSection[] = [
  { title: "Compras", views: [
    { title: "Órdenes de compra", to: "/abastecimiento/ordenes-compra", permission: "purchase-orders:read", phase: 2, source: "/procurement/purchase-orders",
      description: "Las órdenes de compra de los proyectos, desde el borrador hasta el pago.",
      scope: ["Listado por estado, proyecto y búsqueda", "Nueva orden: proveedor, líneas, impuestos y respaldo", "Detalle con su aprobación, revisiones y adjuntos"] },
    { title: "Aprobación OC", to: "/abastecimiento/ordenes-compra/aprobacion", permission: "purchase-orders:approve", phase: 2, source: "/procurement/purchase-orders/approvals",
      description: "Las órdenes que esperan una decisión, para aprobarlas o rechazarlas sin abrirlas una a una.",
      scope: ["Cola de pendientes con el detalle al lado", "Aprobar, o rechazar con motivo"] },
    { title: "Caja chica", to: "/abastecimiento/caja-chica", permission: "petty-cash:read", phase: 2, source: "/procurement/petty-cash",
      description: "Las rendiciones de caja chica: sus gastos con boleta y las órdenes que generan al cerrarse.",
      scope: ["Listado de rendiciones por responsable y estado", "Rendición: gastos con su proyecto y boleta, y cierre"] },
    { title: "Plan de abastecimiento", to: "/abastecimiento/plan", permission: "procurement-plan:read", phase: 2, source: "/procurement/procurement-plan",
      description: "Lo que cada proyecto tiene que comprar y cuántas de sus órdenes ya se emitieron.",
      scope: ["Elegir el proyecto y abrir su plan"] },
    { title: "Remuneraciones", to: "/abastecimiento/remuneraciones", permission: "payroll:read", phase: 2, source: "/procurement/payroll",
      description: "Las personas asignadas a cada proyecto y lo que cuestan cada mes.",
      scope: ["Asignaciones por persona y proyecto, con totales", "Dar de baja", "Descargar y volver a subir la nómina"] },
  ] },
  { title: "Negocios", views: [
    { title: "Negocios", to: "/abastecimiento/negocios", permission: "sales:read", phase: 3, source: "/sales",
      description: "Los negocios adjudicados con su cliente, sus proyectos y sus anexos.",
      scope: ["Listado y nuevo negocio", "Negocio: datos, proyectos, anexos y conciliación de contratos"] },
    { title: "Proyectos", to: "/abastecimiento/proyectos", permission: "sales:read", phase: 3, source: "/projects",
      description: "Los proyectos de la empresa con su negocio, cliente y unidad.", scope: ["Listado con filtros y nuevo proyecto"] },
    { title: "Ventas", to: "/abastecimiento/ventas", permission: "sales:read", phase: 3, source: "/sales/transactions",
      description: "Los estados de pago de cada proyecto, período a período.", scope: ["Ventas por proyecto con su total", "Registrar una venta"] },
    { title: "Escenarios", to: "/abastecimiento/escenarios", permission: "scenario:read", phase: 3, source: "/scenarios",
      description: "Qué pasaría si: ajustes sobre el reporte real de un proyecto o del portafolio.",
      scope: ["Listado y árbol de escenarios", "Escenario: reporte ajustado, constructor de ajustes e historial"] },
    { title: "Vencimientos", to: "/abastecimiento/vencimientos", permission: "contractual-documents:read", phase: 3, source: "/expirations",
      description: "Garantías, pólizas y permisos de cada contrato, los más urgentes primero.", scope: ["Documentos por estado", "Ver el PDF y renovar"] },
  ] },
  { title: "Administración", views: [
    { title: "Unidades de negocio", to: "/abastecimiento/admin/unidades", permission: "business-units:manage", phase: 1, source: "/admin/business-units",
      description: "Las unidades corporativas a las que pertenecen los proyectos.", scope: ["Agregar, renombrar y desactivar unidades"] },
    { title: "Cuentas contables", to: "/abastecimiento/admin/cuentas", permission: "chart-accounts:manage", phase: 1, source: "/admin/chart-accounts",
      description: "El árbol de cuentas con que se clasifica cada gasto e ingreso.", scope: ["Árbol editable con arrastre", "Conflictos de tipo entre cuentas"] },
    { title: "Proveedores", to: "/abastecimiento/admin/proveedores", permission: "vendors:read", phase: 1, source: "/admin/vendors",
      description: "Los proveedores a quienes se compra, con sus datos de contacto y de pago.", scope: ["Listado paginado y activos/inactivos", "Ficha del proveedor y categorías", "Métricas y exportación"] },
    { title: "Clientes", to: "/abastecimiento/admin/clientes", permission: "clients:create", phase: 1, source: "/admin/clients",
      description: "Los clientes y los negocios de cada uno.", scope: ["Agregar, editar y desactivar clientes", "Negocios de cada cliente"] },
    { title: "Perfil de la empresa", to: "/abastecimiento/admin/empresa", permission: "company:manage", phase: 1, source: "/admin/company",
      description: "Los datos de la empresa que encabezan y cierran cada orden de compra.", scope: ["Razón social, RUT, giro, dirección y correos del membrete"] },
    { title: "Impuestos (SII)", to: "/abastecimiento/admin/impuestos", permission: "company:manage", phase: 1, source: "/admin/tax-rates",
      description: "El IVA y la retención de honorarios que aplica cada orden, con la fecha desde la que rigen.", scope: ["Tasas por fecha y reajustes"] },
    // People and roles are Human360's: this entry leads to Personas y accesos instead of a second user admin.
    { title: "Usuarios y roles", to: "/abastecimiento/admin/usuarios", permission: "employees.read",
      description: "Quién usa el módulo y con qué permisos: se gestiona en Personas y accesos." },
  ] },
];

export const procurementViews: ProcurementView[] = [reportView, ...procurementSections.flatMap(section => section.views)];

/** The view a path belongs to and its section, for breadcrumbs ("Abastecimiento › Compras › Caja chica"). */
export function procurementTrail(to: ProcurementPath): string[] {
  const section = procurementSections.find(candidate => candidate.views.some(view => view.to === to));
  const view = procurementViews.find(candidate => candidate.to === to);
  return [MODULE, ...(section ? [section.title] : []), view?.title ?? ""].filter(Boolean);
}
