import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/plan")!.title;

export const Route = createFileRoute("/abastecimiento/plan")({
  component: () => <ViewInProgress to="/abastecimiento/plan" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
