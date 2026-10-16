import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Hourglass, SquareArrowOutUpRight, Users, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InternalChat, type ChatTarget } from "@/components/internal-chat";
import { AdminRequestDetail } from "@/components/requests/admin-request-dialogs";
import { ActionButton, DueDateHead, DueWarning, FiltersAside, PaginationFooter, PersonLink, StatusBadge, SummaryCards, formatDate, useRequestList, type SummaryCard } from "@/components/requests/request-list";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { countByStatus, todayIso } from "@/lib/my-requests";
import { pendingSummary } from "@/lib/catalog";
import { CONTRACT_ADMIN } from "@/lib/organization";
import { listAllRequests } from "@/lib/requests.functions";

export const Route = createFileRoute("/gestionar-solicitudes")({
  loader: () => listAllRequests(),
  component: ManageRequestsPage,
  head: () => ({ meta: [
    { title: "Gestionar solicitudes | Ecosistema X" },
    { name: "description", content: "Bandeja del Administrador de Contrato: autoriza, rechaza o delega solicitudes de requerimientos." },
    { property: "og:title", content: "Gestionar solicitudes | Ecosistema X" },
    { property: "og:description", content: "Autoriza, rechaza o delega solicitudes de requerimientos." },
  ] }),
});

// Same statuses as "Mis solicitudes", named from the administrator's point of view.
const cards: SummaryCard[] = [
  { status: "Autorizado", label: "Solicitudes autorizadas", icon: <CheckCircle2 /> },
  { status: "En revisión", label: "Solicitudes delegadas", icon: <Users /> },
  { status: "Rechazado", label: "Solicitudes rechazadas", icon: <XCircle /> },
  { status: "Enviada", label: "Solicitudes pendientes", icon: <Hourglass /> },
];

function Unassigned() {
  return <span className="unassigned">Sin asignar</span>;
}

function ManageRequestsPage() {
  const today = useMemo(todayIso, []);
  const requests = Route.useLoaderData();
  const router = useRouter();
  const list = useRequestList(requests);
  const counts = useMemo(() => countByStatus(requests), [requests]);
  // Keep the code, not a copy, so the open detail shows fresh data after every decision.
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const reviewing = requests.find(request => request.code === reviewingCode) ?? null;
  const [chat, setChat] = useState<ChatTarget | null>(null);

  return (
    <AppShell trail={["Solicitudes", "Gestionar solicitudes"]}>
      <TooltipProvider delayDuration={200}>
        <div className="my-requests">
          <p className="eyebrow">ADMINISTRADOR DE CONTRATO · {CONTRACT_ADMIN.name.toUpperCase()}</p>
          <h1 className="page-heading">Gestionar solicitudes</h1>
          <p className="page-description">Autoriza o rechaza las solicitudes pendientes, o delégalas al departamento que debe revisarlas.</p>

          <SummaryCards cards={cards} counts={counts} />

          <div className="requests-layout">
            <section className="requests-table-card" aria-label="Solicitudes por gestionar">
              <Table className="requests-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Depto. asignado</TableHead>
                    <TableHead>Encargado asignado</TableHead>
                    <DueDateHead list={list} />
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="actions-head">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.pageData.items.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="requests-empty">No hay solicitudes que coincidan con la búsqueda o los filtros.</TableCell></TableRow>
                  )}
                  {list.pageData.items.map(request => (
                    <TableRow key={request.code}>
                      <TableCell className="request-code">{request.code}</TableCell>
                      <TableCell><span className="category-cell">{request.category}{request.element && <span className="element-cell">{request.element}</span>}{pendingSummary(request.review) && <span className="catalog-flag" title="Novedades para el catálogo por aprobar">{pendingSummary(request.review)}</span>}</span></TableCell>
                      <TableCell>{request.department ?? <Unassigned />}</TableCell>
                      <TableCell>{request.assignee ? <PersonLink person={request.assignee} onOpen={() => setChat({ person: request.assignee!, requestCode: request.code, relation: `Revisa ${request.code}` })} /> : <Unassigned />}</TableCell>
                      <TableCell className="request-date">{formatDate(request.dueDate)}</TableCell>
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
            <FiltersAside list={list} note="Solo las solicitudes pendientes se pueden autorizar, rechazar o delegar. Las delegadas las decide el encargado del departamento." />
          </div>
        </div>

        <AdminRequestDetail request={reviewing} today={today} onClose={() => setReviewingCode(null)} onChanged={() => router.invalidate()}
          onChat={(person, relation) => { setChat({ person, requestCode: reviewing?.code ?? "", relation }); setReviewingCode(null); }} />
        <InternalChat target={chat} onOpenChange={open => { if (!open) setChat(null); }} />
      </TooltipProvider>
    </AppShell>
  );
}
