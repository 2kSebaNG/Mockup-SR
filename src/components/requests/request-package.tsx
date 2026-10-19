import { useRef } from "react";
import { CalendarClock, Check, Eye, Loader2, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DueWarning, StatusBadge, formatDate, statusClass } from "@/components/requests/request-list";
import { packageProgress, responsibleFor, type MyRequest, type RequestStatus } from "@/lib/my-requests";

/** "Paquete REQ-1501": from a child request to the package it belongs to. */
export function ParentLink({ request, onOpen }: { request: MyRequest; onOpen: (parentCode: string) => void }) {
  if (!request.parentCode) return null;
  return (
    <button type="button" className="parent-link" onClick={() => onOpen(request.parentCode!)}>
      <Package aria-hidden="true" />Paquete {request.parentCode}
    </button>
  );
}

type Step = { label: string; state: "done" | "current" | "skipped" | "pending" | "failed" };

/** Where a child is, as a parcel tracker: sent, reviewed by a department (or decided directly), resolved. */
function stepsFor(request: MyRequest): Step[] {
  const decided = request.status === "Autorizado" || request.status === "Rechazado" || request.status === "Anulado";
  const review: Step = request.department
    ? { label: `Revisión ${request.department}`, state: request.status === "En revisión" ? "current" : decided ? "done" : "pending" }
    : { label: decided ? "Sin delegar" : "Revisión", state: decided ? "skipped" : "pending" };
  const end: Step = decided
    ? { label: request.status, state: request.status === "Autorizado" ? "done" : "failed" }
    : { label: "Resolución", state: "pending" };
  return [{ label: "Enviada", state: request.status === "Enviada" ? "current" : "done" }, review, end];
}

function Tracker({ request }: { request: MyRequest }) {
  return (
    <ol className="package-tracker" aria-label={`Seguimiento de ${request.code}`}>
      {stepsFor(request).map(step => (
        <li key={step.label} className={`tracker-step ${step.state}`}>
          <span className="tracker-dot" aria-hidden="true">{step.state === "done" ? <Check /> : step.state === "failed" ? <X /> : null}</span>
          <span className="tracker-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

const progressOrder: RequestStatus[] = ["Autorizado", "Rechazado", "Anulado", "En revisión", "Enviada"];

/**
 * A package followed as one shipment: its overall progress and each child request with its own status, tracker
 * and responsible person. `onOpenChild` opens a child's detail when the viewer may see it.
 */
export function PackageDialog({ parentCode: openCode, children: openChildren, today, loading = false, error = "", onClose, onOpenChild, canOpenChild = () => true }: {
  parentCode: string | null; children: MyRequest[]; today: string; loading?: boolean; error?: string;
  onClose: () => void; onOpenChild: (request: MyRequest) => void; canOpenChild?: (request: MyRequest) => boolean;
}) {
  // Keep showing the last package while the dialog animates closed.
  const last = useRef<{ parentCode: string | null; children: MyRequest[] }>({ parentCode: null, children: [] });
  if (openCode) last.current = { parentCode: openCode, children: openChildren };
  const { parentCode, children } = last.current;
  const first = children[0];
  const progress = packageProgress(children);
  const percent = progress.total ? Math.round((progress.resolved / progress.total) * 100) : 0;
  return (
    <Dialog open={openCode !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="admin-detail package-dialog">
        <DialogHeader>
          <div className="modal-eyebrow"><Package size={15} />SEGUIMIENTO DEL PAQUETE</div>
          <div className="admin-detail-heading"><DialogTitle className="request-detail-title">Solicitud {parentCode}</DialogTitle>{first && <span className={`package-state ${progress.label === "En curso" ? "open" : progress.label === "Anulada" ? "cancelled" : "closed"}`}>{progress.label}</span>}</div>
          <DialogDescription>{first ? <>Solicitado por {first.requester.name} el {formatDate(first.createdAt)} · vence el {formatDate(first.dueDate)} · {children.length} requerimientos</> : "Cargando el paquete…"}</DialogDescription>
        </DialogHeader>
        {loading && <p className="package-loading"><Loader2 className="animate-spin" />Cargando el paquete…</p>}
        {error && <p role="alert" className="requirement-error">{error}</p>}
        {first && <>
          <section className="package-progress" aria-label="Avance del paquete">
            <div className="package-progress-head"><strong>{progress.resolved} de {progress.total} resueltas</strong><span>{percent}%</span></div>
            <div className="package-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.resolved} aria-label="Requerimientos resueltos">
              {progressOrder.map(status => progress.counts[status] > 0 && <span key={status} className={`package-bar-part ${statusClass[status]}`} style={{ flexGrow: progress.counts[status] }} title={`${status}: ${progress.counts[status]}`} />)}
            </div>
            <ul className="package-legend">{progressOrder.filter(status => progress.counts[status] > 0).map(status => <li key={status}><StatusBadge status={status} /> {progress.counts[status]}</li>)}</ul>
          </section>
          {first.description && <blockquote className="request-quote package-quote">{first.description}</blockquote>}
          <ol className="package-children">
            {children.map(child => (
              <li key={child.code} className="package-child">
                <div className="package-child-head">
                  <div className="package-child-title">
                    <span className="request-code">{child.code}</span>
                    <strong>{child.element || child.category}</strong>
                    <span className="package-child-meta">{child.category} · {child.quantity} {child.unit.toLowerCase()}</span>
                  </div>
                  <span className="status-line"><StatusBadge status={child.status} /><DueWarning request={child} today={today} /></span>
                </div>
                <Tracker request={child} />
                <div className="package-child-foot">
                  <span>{child.status === "Anulado" ? <>Anulada por <strong>{child.requester.name}</strong></> : <>{child.status === "Enviada" || child.status === "En revisión" ? "Responsable" : "Decidió"}: <strong>{responsibleFor(child).name}</strong></>}</span>
                  {child.estimatedResolution && (child.status === "Enviada" || child.status === "En revisión") && <span className="estimate-cell"><CalendarClock aria-hidden="true" />Estimada: {formatDate(child.estimatedResolution)}</span>}
                  {canOpenChild(child) && <Button type="button" variant="outline" size="sm" onClick={() => onOpenChild(child)}><Eye />Ver detalle</Button>}
                </div>
                {child.status === "Rechazado" && child.rejectionReason && <p className="package-child-reason"><strong>Razón del rechazo:</strong> {child.rejectionReason}</p>}
              </li>
            ))}
          </ol>
        </>}
      </DialogContent>
    </Dialog>
  );
}
