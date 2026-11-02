import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/remuneraciones")!.title;

export const Route = createFileRoute("/abastecimiento/remuneraciones")({
  component: () => <ViewInProgress to="/abastecimiento/remuneraciones" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
