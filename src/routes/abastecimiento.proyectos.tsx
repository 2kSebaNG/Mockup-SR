import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/proyectos")!.title;

export const Route = createFileRoute("/abastecimiento/proyectos")({
  component: () => <ViewInProgress to="/abastecimiento/proyectos" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
