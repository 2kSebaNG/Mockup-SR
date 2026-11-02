import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/admin/impuestos")!.title;

export const Route = createFileRoute("/abastecimiento/admin/impuestos")({
  component: () => <ViewInProgress to="/abastecimiento/admin/impuestos" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
