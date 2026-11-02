import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/admin/proveedores")!.title;

export const Route = createFileRoute("/abastecimiento/admin/proveedores")({
  component: () => <ViewInProgress to="/abastecimiento/admin/proveedores" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
