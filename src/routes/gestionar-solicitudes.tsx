import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SquareArrowOutUpRight, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InternalChat, type ChatTarget } from "@/components/internal-chat";
import { AdminRequestDetail } from "@/components/requests/admin-request-dialogs";
import { PackageDialog, ParentLink } from "@/components/requests/request-package";
import { ActionButton, DueDateCell, SortableHead, DueWarning, FiltersBar, ViewToggle, viewSearch, withView, PaginationFooter, PersonLink, StatusBadge, formatDate, useRequestList, type ViewMode } from "@/components/requests/request-list";
import { RequestsPageSkeleton } from "@/components/requests/request-skeletons";
import { ReviewDashboard } from "@/components/dashboard/review-dashboard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { packageChildren, todayIso } from "@/lib/my-requests";
import { pendingSummary } from "@/lib/catalog";
import { CONTRACT_ADMIN } from "@/lib/organization";
import { listAllRequests } from "@/lib/requests.functions";

export const Route = createFileRoute("/gestionar-solicitudes")({
  validateSearch: viewSearch,
  loader: () => listAllRequests(),
  pendingComponent: () => <RequestsPageSkeleton trail={["Solicitudes", "Revisar solicitudes"]} title="Revisar solicitudes" columns={9} />,
  component: ManageRequestsPage,
  head: () => ({ meta: [
    { title: "Revisar solicitudes | Ecosistema X" },
    { name: "description", content: "Bandeja del Administrador de Contrato: autoriza, rechaza o delega solicitudes de requerimientos." },
    { property: "og:title", content: "Revisar solicitudes | Ecosistema X" },
    { property: "og:description", content: "Autoriza, rechaza o delega solicitudes de requerimientos." },
  ] }),
});

// Same statuses as "Mis solicitudes", named from the administrator's point of view.

function Unassigned() {
  return <span className="unassigned">Sin asignar</span>;
}

function ManageRequestsPage() {
  const view: ViewMode = Route.useSearch().vista ?? "tabla";
  const navigateView = useNavigate({ from: Route.fullPath });
  // Replace, not push: switching views is not a step back-navigation should undo one by one.
  const setView = (next: ViewMode) => navigateView({ search: prev => withView(prev, next), replace: true });
  const today = useMemo(todayIso, []);
  const requests = Route.useLoaderData();
  const router = useRouter();
  const list = useRequestList(requests, view);
  // Keep the code, not a copy, so the open detail shows fresh data after every decision.
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const reviewing = requests.find(request => request.code === reviewingCode) ?? null;
  const [chat, setChat] = useState<ChatTarget | null>(null);
  const [packageCode, setPackageCode] = useState<string | null>(null);

  return (
    <AppShell trail={["Solicitudes", "Revisar solicitudes"]}>
      <TooltipProvider delayDuration={200}>
        <div className="my-requests">
          <p className="eyebrow">ADMINISTRADOR DE CONTRATO · {CONTRACT_ADMIN.name.toUpperCase()}</p>
          <h1 className="page-heading">Revisar solicitudes</h1>
          <p className="page-description">Autoriza o rechaza las solicitudes pendientes, o delégalas al departamento que debe revisarlas.</p>

          <div className="page-toolbar"><ViewToggle view={view} onChange={setView} /></div>
          <FiltersBar list={list} view={view} />

          {view === "dashboard" ? <ReviewDashboard list={list} today={today} /> : <>
            <div className="requests-layout">
            <section className="requests-table-card" aria-label="Solicitudes por gestionar">
              <Table className="requests-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Depto. asignado</TableHead>
                    <TableHead>Encargado asignado</TableHead>
                    <SortableHead list={list} column="createdAt" />
                    <SortableHead list={list} column="dueDate" />
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="actions-head">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.pageData.items.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="requests-empty">No hay solicitudes que coincidan con la búsqueda o los filtros.</TableCell></TableRow>
                  )}
                  {list.pageData.items.map(request => (
                    <TableRow key={request.code}>
                      <TableCell><span className="code-cell"><span className="request-code">{request.code}</span><ParentLink request={request} onOpen={setPackageCode} /></span></TableCell>
                      <TableCell><span className="category-cell">{request.category}{request.element && <span className="element-cell">{request.element}</span>}{pendingSummary(request.review) && <span className="catalog-flag" title="Novedades para el catálogo por aprobar">{pendingSummary(request.review)}</span>}</span></TableCell>
                      <TableCell>{request.department ?? <Unassigned />}</TableCell>
                      <TableCell>{request.assignee ? <PersonLink person={request.assignee} onOpen={() => setChat({ person: request.assignee!, requestCode: request.code, relation: `Revisa ${request.code}` })} /> : <Unassigned />}</TableCell>
                      <TableCell className="request-date">{formatDate(request.createdAt)}</TableCell>
                      <TableCell className="request-date"><DueDateCell request={request} /></TableCell>
                      <TableCell><div className="status-line"><StatusBadge status={request.status} /><DueWarning request={request} today={today} /></div></TableCell>
                      <TableCell className="authorizer">Por <PersonLink person={request.requester} onOpen={() => setChat({ person: request.requester, requestCode: request.code, relation: `Solicitante de ${request.code}` })} /></TableCell>
                      <TableCell>
                        <div className="row-actions">
                          <ActionButton label={`Revisar ${request.code}`} onClick={() => setReviewingCode(request.code)}><SquareArrowOutUpRight /></ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationFooter list={list} />
            </section>
            </div>
            <p className="requests-note"><Info aria-hidden="true" />Al abrir una solicitud enviada pasa a En revisión. Puedes autorizarla, rechazarla o delegarla; las que están en gestión las decide el encargado del departamento.</p>
          </>}
        </div>

        <PackageDialog parentCode={packageCode} children={packageChildren(requests, packageCode ?? "")} today={today} onClose={() => setPackageCode(null)}
          onOpenChild={child => { setPackageCode(null); setReviewingCode(child.code); }} />
        <AdminRequestDetail request={reviewing} today={today} onClose={() => setReviewingCode(null)} onChanged={() => router.invalidate()}
          onOpenPackage={code => { setReviewingCode(null); setPackageCode(code); }}
          onChat={(person, relation) => { setChat({ person, requestCode: reviewing?.code ?? "", relation }); setReviewingCode(null); }} />
        <InternalChat target={chat} onOpenChange={open => { if (!open) setChat(null); }} />
      </TooltipProvider>
    </AppShell>
  );
}
