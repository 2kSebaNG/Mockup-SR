import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Ban, Building2, ClipboardList, Eye, Loader2, Pencil, Trash2, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequirementModal } from "@/components/requirement-modal";
import { InternalChat, type ChatTarget } from "@/components/internal-chat";
import { RequestContent, RequestOutcome } from "@/components/requests/request-content";
import { PackageDialog, ParentLink } from "@/components/requests/request-package";
import { ActionButton, DueDateCell, SortableHead, DueWarning, RequestsToolbar, viewSearch, withView, PaginationFooter, PersonLink, StatusBadge, formatDate, formatNumericDate, useRequestList, type ViewMode } from "@/components/requests/request-list";
import { RequestsPageSkeleton } from "@/components/requests/request-skeletons";
import { MyRequestsDashboard } from "@/components/dashboard/my-requests-dashboard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { canEdit, canCancel, packageChildren, responsibleFor, todayIso, type MyRequest } from "@/lib/my-requests";
import { cancelMyRequest, listMyRequests } from "@/lib/requests.functions";

export const Route = createFileRoute("/mis-solicitudes")({
  validateSearch: viewSearch,
  loader: () => listMyRequests(),
  pendingComponent: () => <RequestsPageSkeleton trail={["Solicitudes", "Mis solicitudes"]} title="Mis solicitudes" columns={6} />,
  component: MyRequestsPage,
  head: () => ({ meta: [
    { title: "Mis solicitudes | Ecosistema X" },
    { name: "description", content: "Seguimiento de tus solicitudes de requerimientos: estado, fecha límite y quién las revisa." },
    { property: "og:title", content: "Mis solicitudes | Ecosistema X" },
    { property: "og:description", content: "Seguimiento de tus solicitudes de requerimientos." },
  ] }),
});


const relationFor = (request: MyRequest) => request.assignee ? `Revisa ${request.code} (${request.department})` : `Autoriza ${request.code}`;

function MyRequestsPage() {
  const view: ViewMode = Route.useSearch().vista ?? "tabla";
  const navigateView = useNavigate({ from: Route.fullPath });
  // Replace, not push: switching views is not a step back-navigation should undo one by one.
  const setView = (next: ViewMode) => navigateView({ search: prev => withView(prev, next), replace: true });
  const today = useMemo(todayIso, []);
  const requests = Route.useLoaderData();
  const router = useRouter();
  const list = useRequestList(requests, view);
  const cancelRequest = useServerFn(cancelMyRequest);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [viewing, setViewing] = useState<MyRequest | null>(null);
  const [editing, setEditing] = useState<MyRequest | null>(null);
  const [cancelling, setCancelling] = useState<MyRequest | null>(null);
  const [chat, setChat] = useState<ChatTarget | null>(null);
  const [packageCode, setPackageCode] = useState<string | null>(null);
  const openChat = (request: MyRequest) => setChat({ person: responsibleFor(request), requestCode: request.code, relation: relationFor(request) });

  const confirmCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true); setCancelError("");
    try {
      const response = await cancelRequest({ data: { code: cancelling.code } });
      if (!response.request) { setCancelError(response.error); return; }
      await router.invalidate();
      setCancelling(null);
    } catch { setCancelError("No se pudo anular la solicitud. Inténtalo de nuevo."); } finally { setCancelBusy(false); }
  };

  return (
    <AppShell trail={["Solicitudes", "Mis solicitudes"]}>
      <TooltipProvider delayDuration={200}>
        <div className="my-requests">
          <p className="eyebrow">SOLICITUD DE REQUERIMIENTOS</p>
          <h1 className="page-heading">Mis solicitudes</h1>
          <p className="page-description">Revisa el avance de tus solicitudes, quién las revisa y cuáles están próximas a vencer.</p>

          <RequestsToolbar list={list} view={view} onViewChange={setView} />

          {view === "dashboard" ? <MyRequestsDashboard list={list} today={today} /> : <>
            <div className="requests-layout">
            <section className="requests-table-card" aria-label="Listado de solicitudes">
              <Table className="requests-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <SortableHead list={list} column="createdAt" />
                    <SortableHead list={list} column="dueDate" />
                    <TableHead>Estado</TableHead>
                    <TableHead className="actions-head">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.pageData.items.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="requests-empty">No hay solicitudes que coincidan con la búsqueda o los filtros.</TableCell></TableRow>
                  )}
                  {list.pageData.items.map(request => (
                    <TableRow key={request.code}>
                      <TableCell><span className="code-cell"><span className="request-code">{request.code}</span><ParentLink request={request} onOpen={setPackageCode} /></span></TableCell>
                      <TableCell><span className="category-cell">{request.category}{request.element && <span className="element-cell">{request.element}</span>}</span></TableCell>
                      <TableCell className="request-date">{formatDate(request.createdAt)}</TableCell>
                      <TableCell className="request-date"><DueDateCell request={request} /></TableCell>
                      <TableCell>
                        <div className="status-cell">
                          <div className="status-line"><StatusBadge status={request.status} /><DueWarning request={request} today={today} /></div>
                          <span className="authorizer">Por <PersonLink person={responsibleFor(request)} onOpen={() => openChat(request)} /></span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="row-actions">
                          <ActionButton label={`Ver ${request.code}`} onClick={() => setViewing(request)}><Eye /></ActionButton>
                          <ActionButton label={`Editar ${request.code}`} onClick={() => setEditing(request)} disabled={!canEdit(request.status)} reason="Solo se editan solicitudes enviadas, en revisión o en gestión"><Pencil /></ActionButton>
                          <ActionButton label={`Anular ${request.code}`} onClick={() => setCancelling(request)} disabled={!canCancel(request.status)} reason="La solicitud ya está anulada"><Trash2 /></ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationFooter list={list} />
            </section>
            </div>
            <p className="requests-note"><Info aria-hidden="true" />Solo puedes editar solicitudes enviadas, en revisión o en gestión. Si una solicitud ya fue completada o rechazada y necesita cambios, anúlala y crea una nueva.</p>
          </>}
        </div>

        <Dialog open={viewing !== null} onOpenChange={open => { if (!open) setViewing(null); }}>
          <DialogContent className="admin-detail">
        <DialogBody>
            {viewing && <>
              <DialogHeader>
                <div className="modal-eyebrow"><ClipboardList size={15} />DETALLE DE SOLICITUD</div>
                <div className="admin-detail-heading"><DialogTitle className="request-detail-title">Solicitud {viewing.code}</DialogTitle><span className="status-line"><StatusBadge status={viewing.status} /><DueWarning request={viewing} today={today} /></span></div>
                <DialogDescription>Creada el {formatNumericDate(viewing.createdAt)}{viewing.parentCode && <> · parte de <ParentLink request={viewing} onOpen={code => { setViewing(null); setPackageCode(code); }} /></>}</DialogDescription>
              </DialogHeader>
              <RequestContent request={viewing} />
              <RequestOutcome request={viewing} />
              <p className="admin-assignment"><Building2 aria-hidden="true" />{viewing.department ? <>Delegada a <strong>{viewing.department}</strong> · revisa </> : <>Responsable: </>}<PersonLink person={responsibleFor(viewing)} onOpen={() => { openChat(viewing); setViewing(null); }} /><span className="detail-role">{responsibleFor(viewing).role}</span></p>
            </>}
        </DialogBody>
      </DialogContent>
        </Dialog>

        <AlertDialog open={cancelling !== null} onOpenChange={open => { if (!open && !cancelBusy) { setCancelling(null); setCancelError(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Anular la solicitud {cancelling?.code}?</AlertDialogTitle>
              <AlertDialogDescription>La solicitud quedará en estado Anulado y no seguirá su proceso de autorización. Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            {cancelError && <p role="alert" className="requirement-error">{cancelError}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelBusy}>Volver</AlertDialogCancel>
              {/* Keep the dialog open until the server confirms the cancellation. */}
              <AlertDialogAction className="cancel-confirm" disabled={cancelBusy} onClick={event => { event.preventDefault(); void confirmCancel(); }}>{cancelBusy ? <Loader2 className="animate-spin" /> : <Ban />}{cancelBusy ? "Anulando…" : "Anular solicitud"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <PackageDialog parentCode={packageCode} children={packageChildren(requests, packageCode ?? "")} today={today} onClose={() => setPackageCode(null)}
          onOpenChild={child => { setPackageCode(null); setViewing(child); }} />
        <RequirementModal open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }} request={editing} onSaved={() => router.invalidate()} />
        <InternalChat target={chat} onOpenChange={open => { if (!open) setChat(null); }} />
      </TooltipProvider>
    </AppShell>
  );
}
