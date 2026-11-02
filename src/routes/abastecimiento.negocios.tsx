import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/negocios")!.title;

export const Route = createFileRoute("/abastecimiento/negocios")({
  component: () => <ViewInProgress to="/abastecimiento/negocios" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
