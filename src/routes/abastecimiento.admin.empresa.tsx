import { createFileRoute } from "@tanstack/react-router";
import { ViewInProgress } from "@/components/abastecimiento/view-in-progress";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const title = procurementViews.find(view => view.to === "/abastecimiento/admin/empresa")!.title;

export const Route = createFileRoute("/abastecimiento/admin/empresa")({
  component: () => <ViewInProgress to="/abastecimiento/admin/empresa" />,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});
