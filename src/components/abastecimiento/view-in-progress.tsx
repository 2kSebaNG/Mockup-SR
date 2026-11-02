import { Construction } from "lucide-react";
import { AccessPage } from "@/components/access/access-ui";
import { Callout, EmptyState, Page, PageHeader, Panel, Stack } from "@/components/ds";
import { MODULE, procurementSections, procurementTrail, procurementViews, type ProcurementPath } from "@/lib/abastecimiento/navigation";

/**
 * A view of the Abastecimiento module that is not built yet: inside the app frame, behind its permission, with its
 * real title and a summary of what it will hold and when (docs/plan-abastecimiento.md).
 */
export function ViewInProgress({ to }: { to: ProcurementPath }) {
  const view = procurementViews.find(candidate => candidate.to === to)!;
  const section = procurementSections.find(candidate => candidate.views.includes(view));
  return (
    <AccessPage trail={procurementTrail(to)} title={view.title} permission={view.permission}>
      <Page>
        <PageHeader eyebrow={section ? `${MODULE} · ${section.title}` : MODULE} title={view.title} description={view.description} />
        <Stack>
          <Callout variant="info" title="Vista en construcción">
            Llega en la fase {view.phase} de la integración de budget-control{view.source ? <> (origen: <code>{view.source}</code>)</> : null}.
          </Callout>
          {view.scope && (
            <Panel title="Qué tendrá">
              <ul className="list-disc space-y-1 pl-5 text-sm">{view.scope.map(item => <li key={item}>{item}</li>)}</ul>
            </Panel>
          )}
          {!view.scope && <EmptyState icon={<Construction aria-hidden="true" />} title="Aún no hay nada aquí" />}
        </Stack>
      </Page>
    </AccessPage>
  );
}
