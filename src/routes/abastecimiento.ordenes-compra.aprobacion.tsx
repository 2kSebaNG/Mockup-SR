import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/ordenes-compra/aprobacion")!.title;

export const Route = createFileRoute("/abastecimiento/ordenes-compra/aprobacion")({
  component: () => <ViewInProgress to="/abastecimiento/ordenes-compra/aprobacion" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
