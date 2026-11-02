import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/admin/clientes")!.title;

export const Route = createFileRoute("/abastecimiento/admin/clientes")({
  component: () => <ViewInProgress to="/abastecimiento/admin/clientes" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
