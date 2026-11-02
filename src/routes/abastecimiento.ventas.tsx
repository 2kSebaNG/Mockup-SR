import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/ventas")!.title;

export const Route = createFileRoute("/abastecimiento/ventas")({
  component: () => <ViewInProgress to="/abastecimiento/ventas" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
