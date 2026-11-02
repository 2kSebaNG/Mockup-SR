import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/escenarios")!.title;

export const Route = createFileRoute("/abastecimiento/escenarios")({
  component: () => <ViewInProgress to="/abastecimiento/escenarios" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
