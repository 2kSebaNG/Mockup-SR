import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/reporte")!.title;

export const Route = createFileRoute("/abastecimiento/reporte")({
  component: () => <ViewInProgress to="/abastecimiento/reporte" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
