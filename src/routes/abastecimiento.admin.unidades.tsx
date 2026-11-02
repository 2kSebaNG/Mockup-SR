import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/admin/unidades")!.title;

export const Route = createFileRoute("/abastecimiento/admin/unidades")({
  component: () => <ViewInProgress to="/abastecimiento/admin/unidades" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
