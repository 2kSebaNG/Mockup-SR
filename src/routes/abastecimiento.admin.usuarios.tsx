import { createFileRoute, redirect } from "@tanstack/react-router";

// Usuarios y roles of budget-control live in Personas y accesos (Human360), where the Abastecimiento permissions are
// part of the same role catalog; this entry of the Abastecimiento menu only leads there.
export const Route = createFileRoute("/abastecimiento/admin/usuarios")({
  beforeLoad: () => { throw redirect({ to: "/empleados", replace: true }); },
});
