import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { cancelMyRequest, listMyRequests } from "@/lib/requests.functions";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, Eye, Pencil, Search, Send, Trash2, TriangleAlert, XCircle, Info, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { QuickAccess } from "@/components/quick-access";
import { RequirementModal } from "@/components/requirement-modal";
import { InternalChat, type ChatTarget } from "@/components/internal-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import {
  requestStatuses, emptyFilters, canEdit, canCancel, dueState, countByStatus, filterRequests, sortByDueDate, paginate, todayIso, daysBetween,
  type MyRequest, type RequestStatus, type RequestFilters, type SortDirection,
} from "@/lib/my-requests";

export const Route = createFileRoute("/mis-solicitudes")({
  loader: () => listMyRequests(),
  component: MyRequestsPage,
  head: () => ({ meta: [
    { title: "Mis solicitudes | Ecosistema X" },
    { name: "description", content: "Seguimiento de tus solicitudes de requerimientos: estado, fecha límite y autorizador." },
    { property: "og:title", content: "Mis solicitudes | Ecosistema X" },
    { property: "og:description", content: "Seguimiento de tus solicitudes de requerimientos." },
  ] }),
});

const statusClass: Record<RequestStatus, string> = {
  "Enviada": "status-sent",
  "En revisión": "status-review",
  "Autorizado": "status-authorized",
  "Rechazado": "status-rejected",
  "Anulado": "status-cancelled",
};

const summaryCards: { status: RequestStatus; label: string; icon: ReactNode }[] = [
  { status: "Autorizado", label: "Solicitudes autorizadas", icon: <CheckCircle2 /> },
  { status: "En revisión", label: "Solicitudes en revisión", icon: <Clock3 /> },
  { status: "Rechazado", label: "Solicitudes rechazadas", icon: <XCircle /> },
  { status: "Enviada", label: "Solicitudes enviadas", icon: <Send /> },
];

const pageSizes = [10, 25, 50];
const dateFormat = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`status-badge ${statusClass[status]}`}>{status}</span>;
}

function DueWarning({ request, today }: { request: MyRequest; today: string }) {
  const state = dueState(request, today);
  if (!state) return null;
  const left = daysBetween(today, request.dueDate);
  const text = state === "overdue" ? `Vencida hace ${-left} ${-left === 1 ? "día" : "días"}` : left === 0 ? "Vence hoy" : `Vence en ${left} ${left === 1 ? "día" : "días"}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`due-warning ${state}`} role="img" aria-label={text} tabIndex={0}><TriangleAlert /></span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

function FilterGroup({ title, options, selected, onToggle }: { title: string; options: readonly string[]; selected: string[]; onToggle: (option: string, checked: boolean) => void }) {
  return (
    <fieldset className="filter-group">
      <legend>{title}</legend>
      {options.map(option => {
        const id = `${title}-${option}`.replace(/\s+/g, "-").toLowerCase();
        return (
          <label key={option} htmlFor={id} className="filter-option">
            <Checkbox id={id} checked={selected.includes(option)} onCheckedChange={checked => onToggle(option, checked === true)} />
            {option}
          </label>
        );
      })}
    </fieldset>
  );
}

function ActionButton({ label, onClick, disabled, children, reason }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; reason?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The wrapper keeps the tooltip reachable when the button is disabled. */}
        <span tabIndex={disabled ? 0 : -1} className="action-wrapper">
          <Button variant="ghost" size="icon" className="row-action" aria-label={label} disabled={disabled} onClick={onClick}>{children}</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabled && reason ? reason : label}</TooltipContent>
    </Tooltip>
  );
}

function MyRequestsPage() {
  const today = useMemo(todayIso, []);
  const requests = Route.useLoaderData();
  const router = useRouter();
  const cancelRequest = useServerFn(cancelMyRequest);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [filters, setFilters] = useState<RequestFilters>(emptyFilters);
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewing, setViewing] = useState<MyRequest | null>(null);
  const [editing, setEditing] = useState<MyRequest | null>(null);
  const [cancelling, setCancelling] = useState<MyRequest | null>(null);
  const [chat, setChat] = useState<ChatTarget | null>(null);

  const counts = useMemo(() => countByStatus(requests), [requests]);
  const categories = useMemo(() => [...new Set(requests.map(request => request.category))].sort((a, b) => a.localeCompare(b, "es")), [requests]);
  const visible = useMemo(() => sortByDueDate(filterRequests(requests, filters), direction), [requests, filters, direction]);
  const pageData = paginate(visible, page, pageSize);
  const activeFilters = filters.statuses.length + filters.categories.length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0);

  const updateFilters = (patch: Partial<RequestFilters>) => { setFilters(current => ({ ...current, ...patch })); setPage(1); };
  const toggleFilter = (key: "statuses" | "categories", option: string, checked: boolean) => {
    setFilters(current => {
      const values: string[] = current[key];
      return { ...current, [key]: checked ? [...new Set([...values, option])] : values.filter(value => value !== option) };
    });
    setPage(1);
  };
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
    <TooltipProvider delayDuration={200}>
      <SiteHeader />
      <main className="my-requests">
        <p className="eyebrow">SOLICITUD DE REQUERIMIENTOS</p>
        <h1 className="page-heading">Mis solicitudes</h1>
        <p className="page-description">Revisa el avance de tus solicitudes, quién las autoriza y cuáles están próximas a vencer.</p>

        <section className="summary-cards" aria-label="Resumen de solicitudes">
          {summaryCards.map(card => (
            <article key={card.status} className={`summary-card ${statusClass[card.status]}`}>
              <span className="summary-icon" aria-hidden="true">{card.icon}</span>
              <div><strong>{counts[card.status]}</strong><span>{card.label}</span></div>
            </article>
          ))}
        </section>

        <div className="requests-layout">
          <section className="requests-table-card" aria-label="Listado de solicitudes">
            <Table className="requests-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead aria-sort={direction === "asc" ? "ascending" : "descending"}>
                    <button type="button" className="sort-button" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}>
                      Fecha límite{direction === "asc" ? <ArrowUp /> : <ArrowDown />}
                      <span className="sr-only">{direction === "asc" ? "orden ascendente, cambiar a descendente" : "orden descendente, cambiar a ascendente"}</span>
                    </button>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="actions-head">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.items.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="requests-empty">No hay solicitudes que coincidan con la búsqueda o los filtros.</TableCell></TableRow>
                )}
                {pageData.items.map(request => (
                  <TableRow key={request.code}>
                    <TableCell className="request-code">{request.code}</TableCell>
                    <TableCell>{request.category}</TableCell>
                    <TableCell className="request-date">{formatDate(request.dueDate)}</TableCell>
                    <TableCell>
                      <div className="status-cell">
                        <div className="status-line"><StatusBadge status={request.status} /><DueWarning request={request} today={today} /></div>
                        <span className="authorizer">Por <button type="button" className="authorizer-link" onClick={() => setChat({ person: request.authorizer, requestCode: request.code })} title={`Abrir chat interno con ${request.authorizer.name}`}>{request.authorizer.name}</button></span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="row-actions">
                        <ActionButton label={`Ver ${request.code}`} onClick={() => setViewing(request)}><Eye /></ActionButton>
                        <ActionButton label={`Editar ${request.code}`} onClick={() => setEditing(request)} disabled={!canEdit(request.status)} reason="Solo se editan solicitudes Enviadas o En revisión"><Pencil /></ActionButton>
                        <ActionButton label={`Anular ${request.code}`} onClick={() => setCancelling(request)} disabled={!canCancel(request.status)} reason="La solicitud ya está anulada"><Trash2 /></ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <footer className="pagination">
              <div className="page-size">
                <span id="page-size-label">Filas por página</span>
                <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
                  <SelectTrigger aria-labelledby="page-size-label" className="page-size-trigger"><SelectValue /></SelectTrigger>
                  <SelectContent>{pageSizes.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <span className="page-range" aria-live="polite">{visible.length ? `${pageData.start + 1}–${pageData.end} de ${visible.length}` : "0 de 0"}</span>
              <div className="page-buttons">
                <Button variant="outline" size="sm" onClick={() => setPage(pageData.page - 1)} disabled={pageData.page <= 1}><ChevronLeft />Anterior</Button>
                <span className="page-number">Página {pageData.page} de {pageData.pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(pageData.page + 1)} disabled={pageData.page >= pageData.pageCount}>Siguiente<ChevronRight /></Button>
              </div>
            </footer>
          </section>

          <aside className="requests-sidebar" aria-label="Búsqueda y filtros">
            <div className="search-box">
              <label htmlFor="request-search">Buscar</label>
              <div className="search-input"><Search aria-hidden="true" /><Input id="request-search" type="search" placeholder="Código, ej. REQ-1234" value={filters.query} onChange={event => updateFilters({ query: event.target.value })} /></div>
            </div>
            <section className="filter-panel">
              <div className="filter-heading"><h2>Filtrar</h2>{activeFilters > 0 && <Button variant="link" size="sm" onClick={() => updateFilters({ statuses: [], categories: [], from: "", to: "" })}>Limpiar ({activeFilters})</Button>}</div>
              <FilterGroup title="Estado" options={requestStatuses} selected={filters.statuses} onToggle={(option, checked) => toggleFilter("statuses", option, checked)} />
              <FilterGroup title="Categoría" options={categories} selected={filters.categories} onToggle={(option, checked) => toggleFilter("categories", option, checked)} />
              <fieldset className="filter-group">
                <legend>Rango de fecha límite</legend>
                <div className="date-range">
                  <label>Desde<Input type="date" value={filters.from} max={filters.to || undefined} onChange={event => updateFilters({ from: event.target.value })} /></label>
                  <label>Hasta<Input type="date" value={filters.to} min={filters.from || undefined} onChange={event => updateFilters({ to: event.target.value })} /></label>
                </div>
              </fieldset>
            </section>
            <p className="requests-note"><Info aria-hidden="true" />Solo puedes editar solicitudes Enviadas o En revisión. Si una solicitud ya fue tramitada y necesita cambios, anúlala y crea una nueva.</p>
          </aside>
        </div>
      </main>

      <Dialog open={viewing !== null} onOpenChange={open => { if (!open) setViewing(null); }}>
        <DialogContent className="request-detail">
          {viewing && <>
            <DialogHeader>
              <div className="modal-eyebrow"><ClipboardList size={15} />DETALLE DE SOLICITUD</div>
              <DialogTitle className="request-detail-title">{viewing.code}</DialogTitle>
              <DialogDescription>{viewing.description}</DialogDescription>
            </DialogHeader>
            <dl className="detail-grid">
              <div><dt>Estado</dt><dd className="status-line"><StatusBadge status={viewing.status} /><DueWarning request={viewing} today={today} /></dd></div>
              <div><dt>Categoría</dt><dd>{viewing.category}</dd></div>
              <div><dt>Cantidad</dt><dd>{viewing.quantity} {viewing.unit.toLowerCase()}</dd></div>
              <div><dt>Fecha límite</dt><dd>{formatDate(viewing.dueDate)}</dd></div>
              <div><dt>Creada</dt><dd>{formatDate(viewing.createdAt)}</dd></div>
              <div><dt>Autoriza</dt><dd><button type="button" className="authorizer-link" onClick={() => { setChat({ person: viewing.authorizer, requestCode: viewing.code }); setViewing(null); }}>{viewing.authorizer.name}</button><span className="detail-role">{viewing.authorizer.role}</span></dd></div>
              {viewing.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
            </dl>
          </>}
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

      <RequirementModal open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }} request={editing} onSaved={() => router.invalidate()} />
      <InternalChat target={chat} onOpenChange={open => { if (!open) setChat(null); }} />
      <QuickAccess />
    </TooltipProvider>
  );
}
