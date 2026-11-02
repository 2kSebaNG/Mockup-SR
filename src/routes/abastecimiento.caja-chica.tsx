import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/caja-chica")!.title;

export const Route = createFileRoute("/abastecimiento/caja-chica")({
  component: () => <ViewInProgress to="/abastecimiento/caja-chica" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
