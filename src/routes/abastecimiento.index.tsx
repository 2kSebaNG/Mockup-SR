import { createFileRoute, redirect } from "@tanstack/react-router";

// The module opens on its report, as budget-control did.
export const Route = createFileRoute("/abastecimiento/")({
  beforeLoad: () => { throw redirect({ to: "/abastecimiento/reporte", replace: true }); },
});
