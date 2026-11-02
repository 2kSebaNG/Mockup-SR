import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/vencimientos")!.title;

export const Route = createFileRoute("/abastecimiento/vencimientos")({
  component: () => <ViewInProgress to="/abastecimiento/vencimientos" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
