import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/admin/cuentas")!.title;

export const Route = createFileRoute("/abastecimiento/admin/cuentas")({
  component: () => <ViewInProgress to="/abastecimiento/admin/cuentas" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
