import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Building2, CalendarClock, CheckSquare, Loader2, Save, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RequestContent, RequestOutcome } from "@/components/requests/request-content";
import { DueWarning, PersonLink, StatusBadge, formatNumericDate } from "@/components/requests/request-list";
import { canDecide, canEstimate, REJECTION_REASON_MIN, statusPhrase, todayIso, type MyRequest, type ReviewedRequest } from "@/lib/my-requests";
import { ClassificationReview } from "@/components/requests/classification-review";
import { CONTRACT_ADMIN, departments, findDepartment, type Person } from "@/lib/organization";
import { decideAsReviewer, decideRequest, delegateRequest, setEstimatedResolution, suggestRequestDelegation } from "@/lib/requests.functions";

const requestedBy = (request: MyRequest) => `Solicitado por: ${request.requester.name} el ${formatNumericDate(request.createdAt)}`;

/** Picks the reviewing department and person; starts from the AI (or rule) suggestion, which the administrator may change. */
function DelegateDialog({ request, onClose, onDelegated }: { request: MyRequest | null; onClose: () => void; onDelegated: () => Promise<void> }) {
  const suggest = useServerFn(suggestRequestDelegation);
  const delegate = useServerFn(delegateRequest);
  const [department, setDepartment] = useState("");
  const [assignee, setAssignee] = useState("");
  const [hint, setHint] = useState<{ source: "ia" | "reglas"; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!request) return;
    let active = true;
    setDepartment(""); setAssignee(""); setHint(null); setError(""); setLoading(true);
    suggest({ data: { code: request.code } })
      .then(response => {
        if (!active) return;
        if (!response.suggestion) { setError(response.error ?? "No se pudo obtener una sugerencia."); return; }
        setDepartment(response.suggestion.department); setAssignee(response.suggestion.assigneeName);
        setHint({ source: response.suggestion.source, reason: response.suggestion.reason });
      })
      .catch(() => { if (active) setError("No se pudo obtener una sugerencia; elige el departamento manualmente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request?.code]);

  const members = findDepartment(department)?.members ?? [];
  const changeDepartment = (value: string) => { setDepartment(value); setAssignee(findDepartment(value)?.members[0]?.name ?? ""); };
  const confirm = async () => {
    if (!request) return;
    setSaving(true); setError("");
    try {
      const response = await delegate({ data: { code: request.code, department, assigneeName: assignee } });
      if (!response.request) { setError(response.error); return; }
      await onDelegated();
    } catch { setError("No se pudo delegar la solicitud. Inténtalo de nuevo."); } finally { setSaving(false); }
  };

  return (
    <Dialog open={request !== null} onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="delegate-dialog">
        <DialogHeader className="delegate-header">
          <div className="modal-eyebrow"><Building2 size={15} />DELEGAR SOLICITUD</div>
          <DialogTitle className="delegate-title">¿A qué unidad corresponde este requerimiento?</DialogTitle>
          <DialogDescription>{request && `Solicitud ${request.code} · ${requestedBy(request)}`}</DialogDescription>
        </DialogHeader>
        <div className="delegate-body">
          <div className="delegate-fields">
            <div className="requirement-field">
              <label id="delegate-department-label">Departamento</label>
              <Select value={department} onValueChange={changeDepartment} disabled={loading || saving}>
                <SelectTrigger aria-labelledby="delegate-department-label" className="requirement-control"><SelectValue placeholder={loading ? "Analizando…" : "Seleccionar departamento"} /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="requirement-field">
              <label id="delegate-assignee-label">Encargado</label>
              <Select value={assignee} onValueChange={setAssignee} disabled={loading || saving || !department}>
                <SelectTrigger aria-labelledby="delegate-assignee-label" className="requirement-control"><SelectValue placeholder="Seleccionar encargado" /></SelectTrigger>
                <SelectContent>{members.map(member => <SelectItem key={member.name} value={member.name}>{member.name} · {member.role}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="delegate-hint" role="status">
            {loading ? <><Loader2 className="animate-spin" />La IA está eligiendo el departamento según el requerimiento…</>
              : hint ? <>{hint.source === "ia" ? <Wand2 /> : <Bot />}<span><strong>{hint.source === "ia" ? "Sugerido por IA" : "Sugerencia automática"}:</strong> {hint.reason} Puedes cambiarlo si no corresponde.</span></> : null}
          </p>
          {error && <p role="alert" className="requirement-error">{error}</p>}
        </div>
        <DialogFooter className="delegate-footer">
          <Button type="button" className="decision-reject" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button type="button" className="decision-authorize" disabled={loading || saving || !department || !assignee} onClick={confirm}>{saving && <Loader2 className="animate-spin" />}{saving ? "Delegando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sets the date the request is expected to be resolved; the requester sees it in their detail and table. */
function EstimateEditor({ request, reviewer, onChanged }: { request: MyRequest; reviewer?: { department: string; assigneeName: string } | undefined; onChanged: () => Promise<void> }) {
  const save = useServerFn(setEstimatedResolution);
  const [date, setDate] = useState(request.estimatedResolution ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDate(request.estimatedResolution ?? ""); }, [request.code, request.estimatedResolution]);
  useEffect(() => { setError(""); setSaved(false); }, [request.code]);
  const store = async (value: string | null) => {
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await save({ data: { code: request.code, date: value, ...(reviewer && { reviewer }) } });
      if (!response.request) { setError(response.error); return; }
      await onChanged();
      setSaved(true);
    } catch { setError("No se pudo guardar la fecha estimada. Inténtalo de nuevo."); } finally { setBusy(false); }
  };
  const min = request.createdAt > todayIso() ? request.createdAt : todayIso();
  return (
    <section className="estimate-editor" aria-labelledby={`estimate-${request.code}`}>
      <label id={`estimate-${request.code}`} htmlFor={`estimate-input-${request.code}`}><CalendarClock aria-hidden="true" />Fecha estimada de resolución</label>
      <div className="estimate-row">
        <Input id={`estimate-input-${request.code}`} type="date" value={date} min={min} disabled={busy} onChange={event => { setDate(event.target.value); setSaved(false); }} />
        <Button type="button" size="sm" variant="outline" disabled={busy || !date || date === request.estimatedResolution} onClick={() => store(date)}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{request.estimatedResolution ? "Cambiar" : "Asignar"}</Button>
        {request.estimatedResolution && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => store(null)}><X />Quitar</Button>}
      </div>
      <p className="estimate-note" role="status">{saved ? "Fecha guardada. El solicitante ya la ve en su solicitud." : request.estimatedResolution ? `${request.requester.name} ve esta fecha en su solicitud.` : `Opcional: indica a ${request.requester.name} cuándo esperas resolverla.`}</p>
      {error && <p role="alert" className="requirement-error">{error}</p>}
    </section>
  );
}

/**
 * Request detail with the decisions. Without `reviewer` it acts as the contract administrator (delegate / authorize /
 * reject pending requests); with `reviewer` it acts as that department reviewer (authorize / reject what is in review).
 */
export function AdminRequestDetail({ request, today, onClose, onChanged, onChat, reviewer }: { request: ReviewedRequest | null; today: string; onClose: () => void; onChanged: () => Promise<void>; onChat: (person: Person, relation: string) => void; reviewer?: { department: string; assigneeName: string } }) {
  const decideAsAdmin = useServerFn(decideRequest);
  const decideAsDepartment = useServerFn(decideAsReviewer);
  const [busy, setBusy] = useState<"Autorizado" | "Rechazado" | null>(null);
  const [error, setError] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [delegating, setDelegating] = useState<MyRequest | null>(null);
  useEffect(() => { setError(""); setBusy(null); setReason(""); setReasonError(""); }, [request?.code]);

  const apply = async (decision: "Autorizado" | "Rechazado") => {
    if (!request) return;
    const why = decision === "Rechazado" ? reason.trim() : undefined;
    if (why !== undefined && why.length < REJECTION_REASON_MIN) { setReasonError(`Escribe la razón del rechazo (al menos ${REJECTION_REASON_MIN} caracteres).`); return; }
    setBusy(decision); setError(""); setReasonError("");
    try {
      const data = { code: request.code, decision, ...(why !== undefined && { reason: why }) };
      const response = reviewer ? await decideAsDepartment({ data: { reviewer, ...data } }) : await decideAsAdmin({ data });
      if (!response.request) { setError(response.error); return; }
      setConfirmReject(false); setReason("");
      await onChanged();
      onClose();
    } catch { setError("No se pudo guardar la decisión. Inténtalo de nuevo."); } finally { setBusy(null); }
  };
  const pending = !request ? false : reviewer ? request.status === "En revisión" && request.assignee?.name === reviewer.assigneeName : canDecide(request.status);
  // The administrator may set the estimate before or after delegating; a reviewer only for what they are reviewing.
  const estimable = !request ? false : reviewer ? pending : canEstimate(request.status);

  return <>
    <Dialog open={request !== null && delegating === null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="admin-detail">
        {request && <>
          <DialogHeader>
            <div className="admin-detail-heading"><DialogTitle className="request-detail-title">Solicitud {request.code}</DialogTitle><span className="status-line"><StatusBadge status={request.status} /><DueWarning request={request} today={today} /></span></div>
            <DialogDescription>Solicitado por: <PersonLink person={request.requester} onOpen={() => onChat(request.requester, `Solicitante de ${request.code}`)} /> el {formatNumericDate(request.createdAt)}</DialogDescription>
          </DialogHeader>
          {/* Only the contract administrator sees and decides catalog novelties. */}
          <RequestContent request={request} {...(!reviewer && { review: request.review })} />
          {!reviewer && <ClassificationReview request={request} onReviewed={onChanged} />}
          {request.department && request.assignee && (reviewer
            ? <p className="admin-assignment"><Building2 aria-hidden="true" />Delegada a <strong>{request.department}</strong> por <PersonLink person={CONTRACT_ADMIN} onOpen={() => onChat(CONTRACT_ADMIN, `Delegó ${request.code}`)} /><span className="detail-role">{CONTRACT_ADMIN.role}</span></p>
            : <p className="admin-assignment"><Building2 aria-hidden="true" />Delegada a <strong>{request.department}</strong> · revisa <PersonLink person={request.assignee} onOpen={() => onChat(request.assignee!, `Revisa ${request.code}`)} /></p>)}
          {estimable ? <EstimateEditor request={request} reviewer={reviewer} onChanged={onChanged} /> : <RequestOutcome request={request} />}
          {error && <p role="alert" className="requirement-error">{error}</p>}
          <DialogFooter className="admin-detail-footer">
            {pending ? <>
              {!reviewer && <Button type="button" className="decision-delegate" disabled={busy !== null} onClick={() => setDelegating(request)}><Building2 />Delegar a un departamento</Button>}
              <Button type="button" className="decision-authorize" disabled={busy !== null} onClick={() => apply("Autorizado")}>{busy === "Autorizado" ? <Loader2 className="animate-spin" /> : <CheckSquare />}Autorizar</Button>
              <Button type="button" className="decision-reject" disabled={busy !== null} onClick={() => setConfirmReject(true)}><Trash2 />Rechazar</Button>
            </> : <p className="admin-decided">{request.status === "En revisión" && !reviewer ? "En revisión por el departamento; su encargado decidirá si se autoriza o rechaza." : `Esta solicitud ya está ${statusPhrase(request.status)}.`}</p>}
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmReject} onOpenChange={open => { if (!open && !busy) { setConfirmReject(false); setReasonError(""); } }}>
      {/* Start in the reason box: it has to be filled before rejecting. */}
      <AlertDialogContent onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("reject-reason")?.focus(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Rechazar la solicitud {request?.code}?</AlertDialogTitle>
          <AlertDialogDescription>{request?.requester.name} verá la solicitud como rechazada junto con la razón que escribas. Esta acción no se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="requirement-field reject-reason">
          <label htmlFor="reject-reason">Razón del rechazo<span className="required-mark" aria-hidden="true">*</span></label>
          <Textarea id="reject-reason" required maxLength={1000} value={reason} disabled={busy !== null} aria-invalid={reasonError ? true : undefined} aria-describedby="reject-reason-help"
            placeholder="Ej. Ya hay stock en bodega; retíralo con un vale de consumo." onChange={event => { setReason(event.target.value); setReasonError(""); }} />
          <span id="reject-reason-help" className="reject-reason-help">{reason.trim().length < REJECTION_REASON_MIN ? `Obligatoria · mínimo ${REJECTION_REASON_MIN} caracteres` : "Se mostrará al solicitante"} · {reason.length} / 1000</span>
        </div>
        {(reasonError || error) && <p role="alert" className="requirement-error">{reasonError || error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy !== null}>Volver</AlertDialogCancel>
          <AlertDialogAction className="cancel-confirm" disabled={busy !== null || reason.trim().length < REJECTION_REASON_MIN} onClick={event => { event.preventDefault(); void apply("Rechazado"); }}>{busy === "Rechazado" ? <Loader2 className="animate-spin" /> : <Trash2 />}{busy === "Rechazado" ? "Rechazando…" : "Rechazar solicitud"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <DelegateDialog request={delegating} onClose={() => setDelegating(null)} onDelegated={async () => { await onChanged(); setDelegating(null); onClose(); }} />
  </>;
}
