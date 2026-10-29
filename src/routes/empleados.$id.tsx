import { useState, type ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Ban, ExternalLink, Loader2, Mail, MailWarning, Pencil, RotateCcw, Send, ShieldCheck, Trash2, UserRoundCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, EmployeeStatusBadge, ErrorAlert, fieldError, formatDateTime, initials, useActor, useCountdown } from "@/components/access/access-ui";
import { EmployeeForm } from "@/components/access/employee-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_SENDS_PER_DAY, can, canResendAt, changeEmail, deactivateEmployee, deleteEmployee, deliverable, emailStatusLabels, emailStatusOf, employeeStatus, findEmployee, findRole, formatRut, fullName,
  permissionCatalog, permissionsOf, reactivateEmployee, resendInvitation, revokeInvitation, updateEmployee, withinScope, type AccessError, type AccessState, type Employee, type Outcome, type Step,
} from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/empleados/$id")({
  component: () => <AccessPage trail={["Personas y accesos", "Empleados", "Detalle"]} title="Empleado" permission="employees.read"><EmployeeDetailPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Empleado | Ecosistema X" }] }),
});

type Dialogs = "edit" | "email" | "revoke" | "deactivate" | "reactivate" | "delete" | null;

function Item({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-item"><dt>{label}</dt><dd>{children}</dd></div>;
}

function PersonName({ state, id }: { state: AccessState; id: string | null }) {
  const person = id ? findEmployee(state, id) : undefined;
  if (!person) return <>{id ? "Usuario eliminado" : "El sistema"}</>;
  return <Link to="/empleados/$id" params={{ id: person.id }} className="person-link">{fullName(person)}</Link>;
}

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const { state, actor } = useActor();
  const navigate = useNavigate();
  const employee = findEmployee(state, id);
  const [open, setOpen] = useState<Dialogs>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AccessError | null>(null);
  const [reason, setReason] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const resendAt = employee ? canResendAt(employee) : null;
  const wait = useCountdown(resendAt);

  if (!employee) {
    return (
      <div className="my-requests">
        <Link to="/empleados" className="access-back"><ArrowLeft aria-hidden="true" />Empleados</Link>
        <div className="access-empty"><UserX aria-hidden="true" /><h2>El empleado no existe</h2><p>Puede que lo hayan eliminado o que su invitación se haya revocado.</p><Button asChild variant="outline"><Link to="/empleados">Ver empleados</Link></Button></div>
      </div>
    );
  }

  const status = employeeStatus(employee);
  const isSelf = employee.id === actor.id;
  const scoped = withinScope(state, actor, employee);
  const writable = !isSelf && scoped;
  const pending = status === "pending" || status === "expired";
  const invitation = employee.invitation;
  const mailStatus = invitation ? emailStatusOf(invitation) : null;
  const mailOk = mailStatus ? deliverable(mailStatus) : true;
  const sendsToday = invitation ? invitation.sends.filter(time => Date.parse(time) > Date.now() - 86_400_000).length : 0;
  const permissions = permissionsOf(state, employee);

  const close = () => { if (!busy) { setOpen(null); setError(null); setReason(""); setConfirmEmail(""); } };
  /** Runs an action like a request: busy while it waits, the message as a toast, the error in its dialog. */
  async function run<T>(key: string, operation: (current: AccessState) => Step<T>, after?: (outcome: Extract<Outcome<T>, { ok: true }>) => void) {
    setBusy(key); setError(null);
    const outcome = await call(operation);
    setBusy(null);
    if (!outcome.ok) {
      setError(outcome.error);
      if (!open) toast.error(outcome.error.message);
      return;
    }
    toast.success(outcome.message);
    setOpen(null); setReason(""); setConfirmEmail("");
    after?.(outcome);
  }
  const goToList = () => void navigate({ to: "/empleados" });

  const action = (key: string, label: string, icon: ReactNode, onClick: () => void, options: { variant?: "outline" | "destructive"; disabled?: boolean; title?: string | undefined } = {}) => (
    <Button key={key} variant={options.variant ?? "outline"} disabled={options.disabled || busy !== null} title={options.title} onClick={onClick}>
      {busy === key ? <Loader2 className="animate-spin" /> : icon}{label}
    </Button>
  );
  const actions: ReactNode[] = [];
  if (writable && pending && can(state, "employees.invite")) {
    actions.push(action("resend", wait ? `Reenviar en ${wait} s` : "Reenviar invitación", <Send />, () => void run("resend", current => resendInvitation(current, actor, employee.id)),
      { disabled: !mailOk || wait > 0, title: !mailOk ? "El correo no llega a esa dirección: cámbialo para reenviar." : undefined }));
    actions.push(action("email", "Cambiar correo", <Mail />, () => { setNewEmail(employee.email); setOpen("email"); }, { disabled: wait > 0 }));
  }
  if (writable && can(state, "employees.manage")) actions.push(action("edit", "Editar", <Pencil />, () => setOpen("edit")));
  if (writable && status === "active" && can(state, "employees.deactivate")) actions.push(action("deactivate", "Desactivar", <Ban />, () => setOpen("deactivate")));
  if (writable && status === "deactivated" && can(state, "employees.deactivate")) actions.push(action("reactivate", "Reactivar", <RotateCcw />, () => setOpen("reactivate")));
  if (writable && pending && can(state, "employees.invite")) actions.push(action("revoke", "Revocar invitación", <Trash2 />, () => setOpen("revoke"), { variant: "destructive" }));
  if (writable && !pending && can(state, "employees.delete")) actions.push(action("delete", "Eliminar", <Trash2 />, () => setOpen("delete"), { variant: "destructive" }));

  return (
    <div className="my-requests">
      <Link to="/empleados" className="access-back"><ArrowLeft aria-hidden="true" />Empleados</Link>
      <header className="employee-header">
        <span className="employee-avatar" aria-hidden="true">{initials(fullName(employee))}</span>
        <div className="employee-title">
          <p className="eyebrow">EMPLEADO</p>
          <h1 className="page-heading">{fullName(employee)}</h1>
          <p className="employee-subtitle"><EmployeeStatusBadge status={status} /><span>{employee.email}</span></p>
        </div>
      </header>

      {isSelf && <p className="requests-note access-note"><ShieldCheck aria-hidden="true" />Esta es tu cuenta. Por seguridad, nadie puede modificar su propia cuenta desde aquí: pídeselo a otro administrador.</p>}
      {!isSelf && !scoped && <p className="requests-note access-note"><ShieldCheck aria-hidden="true" />Tiene permisos que tú no tienes, así que solo puedes ver su información.</p>}
      {actions.length > 0 && <div className="employee-actions" aria-label="Acciones">{actions}</div>}

      <div className="detail-grid">
        <section className="access-card">
          <h2 className="access-card-title">Datos personales</h2>
          <dl className="detail-list">
            <Item label="Nombre">{employee.firstName}</Item>
            <Item label="Apellidos">{employee.lastName}</Item>
            <Item label="RUT">{formatRut(employee.rut)}</Item>
            <Item label="Correo">{employee.email}</Item>
          </dl>
        </section>

        {invitation ? (
          <section className="access-card">
            <h2 className="access-card-title">Invitación</h2>
            <dl className="detail-list">
              <Item label="Estado">{status === "expired" ? "Vencida: reenvíala para darle un enlace nuevo" : "Esperando que la acepte"}</Item>
              <Item label="Vence">{formatDateTime(invitation.expiresAt)}</Item>
              <Item label="Último envío">{formatDateTime(invitation.sends.at(-1)!)}</Item>
              <Item label="Envíos hoy">{sendsToday} de {MAX_SENDS_PER_DAY}</Item>
              <Item label="Correo">{emailStatusLabels[mailStatus!]} · {formatDateTime(invitation.email.updatedAt)}</Item>
            </dl>
            {!mailOk && <p className="access-warning"><MailWarning aria-hidden="true" /><span>El correo no llega a esta dirección. Revisa que esté bien escrita y usa <strong>Cambiar correo</strong> para enviarla de nuevo.</span></p>}
            {can(state, "employees.invite") && (
              <a className="access-demo-link" href={`/invitacion#token=${invitation.token}`} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />Abrir el enlace de su invitación (maqueta)
              </a>
            )}
          </section>
        ) : (
          <section className="access-card">
            <h2 className="access-card-title">Acceso</h2>
            <dl className="detail-list">
              <Item label="Entra con">{employee.signInMethods.map(method => (method === "password" ? "Contraseña" : "Microsoft")).join(" y ") || "—"}</Item>
              <Item label="Activó su cuenta">{employee.activatedAt ? formatDateTime(employee.activatedAt) : "—"}</Item>
              {employee.deactivation && <>
                <Item label="Desactivado">{formatDateTime(employee.deactivation.at)} por <PersonName state={state} id={employee.deactivation.by} /></Item>
                <Item label="Motivo">{employee.deactivation.reason ?? "Sin motivo registrado"}</Item>
              </>}
            </dl>
          </section>
        )}

        <section className="access-card">
          <h2 className="access-card-title">Roles</h2>
          <ul className="role-links">
            {employee.roleIds.map(roleId => findRole(state, roleId)).filter(Boolean).map(role => (
              <li key={role!.id}>
                {can(state, "roles.read") ? <Link to="/roles/$id" params={{ id: role!.id }} className="role-chip link">{role!.name}</Link> : <span className="role-chip">{role!.name}</span>}
              </li>
            ))}
          </ul>
          <h3 className="access-subtitle">Permisos que suman sus roles</h3>
          <ul className="permission-summary">
            {permissionCatalog.map(group => {
              const granted = group.permissions.filter(permission => permissions.includes(permission.code));
              return granted.length ? <li key={group.key}><strong>{group.name}</strong>{granted.map(permission => permission.name).join(" · ")}</li> : null;
            })}
          </ul>
        </section>

        <section className="access-card">
          <h2 className="access-card-title">Registro</h2>
          <dl className="detail-list">
            <Item label="Alta">{formatDateTime(employee.createdAt)}</Item>
            <Item label="Invitado por"><PersonName state={state} id={employee.createdBy} /></Item>
          </dl>
        </section>
      </div>

      <Dialog open={open === "edit"} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="access-dialog">
          <DialogHeader>
            <DialogTitle>Editar a {fullName(employee)}</DialogTitle>
            <DialogDescription>Los roles nuevos rigen desde su siguiente acción en la plataforma.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {open === "edit" && <EmployeeForm state={state} actor={actor} employee={employee} submitLabel="Guardar cambios" busyLabel="Guardando…" busy={busy === "edit"} error={error} onCancel={close}
              onSubmit={input => void run("edit", current => updateEmployee(current, actor, employee.id, input))} />}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "email"} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="access-dialog">
          <DialogHeader>
            <DialogTitle>Cambiar el correo de la invitación</DialogTitle>
            <DialogDescription>Le enviaremos una invitación nueva a esta dirección; el enlace anterior deja de funcionar.</DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={event => { event.preventDefault(); void run("email", current => changeEmail(current, actor, employee.id, newEmail)); }}>
            <FieldGroup>
              <ErrorAlert error={error && !error.details ? error : null} />
              <Field data-invalid={Boolean(fieldError(error, "email"))}>
                <FieldLabel htmlFor="new-email">Correo nuevo</FieldLabel>
                <Input id="new-email" type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} aria-invalid={Boolean(fieldError(error, "email"))} />
                <FieldError>{fieldError(error, "email")}</FieldError>
              </Field>
              <div className="access-form-actions">
                <Button type="button" variant="outline" disabled={busy !== null} onClick={close}>Cancelar</Button>
                <Button type="submit" disabled={busy !== null}>{busy === "email" && <Loader2 className="animate-spin" />}Guardar y reenviar</Button>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Confirm open={open === "revoke"} onClose={close} busy={busy === "revoke"} error={error} title={`¿Revocar la invitación de ${employee.firstName}?`} confirmLabel="Revocar invitación" icon={<Trash2 />}
        description="El enlace deja de funcionar y el empleado se elimina. Su correo y su RUT quedan libres para invitarlo de nuevo."
        onConfirm={() => void run("revoke", current => revokeInvitation(current, actor, employee.id), goToList)} />

      <Confirm open={open === "deactivate"} onClose={close} busy={busy === "deactivate"} error={error} title={`¿Desactivar a ${fullName(employee)}?`} confirmLabel="Desactivar" icon={<Ban />}
        description="Sus sesiones se cierran de inmediato y no podrá entrar ni con contraseña ni con Microsoft. Puedes reactivarlo cuando quieras: conserva sus roles."
        onConfirm={() => void run("deactivate", current => deactivateEmployee(current, actor, employee.id, reason))}>
        <ReasonField value={reason} onChange={setReason} error={fieldError(error, "reason")} />
      </Confirm>

      <Confirm open={open === "reactivate"} onClose={close} busy={busy === "reactivate"} error={error} title={`¿Reactivar a ${fullName(employee)}?`} confirmLabel="Reactivar" icon={<UserRoundCheck />} tone="default"
        description="Podrá volver a entrar con sus mismos roles y su misma contraseña."
        onConfirm={() => void run("reactivate", current => reactivateEmployee(current, actor, employee.id))} />

      <Confirm open={open === "delete"} onClose={close} busy={busy === "delete"} error={error} title={`¿Eliminar a ${fullName(employee)}?`} confirmLabel="Eliminar definitivamente" icon={<Trash2 />}
        disabled={confirmEmail.trim().toLowerCase() !== employee.email}
        description="Sus sesiones se cierran y su cuenta se elimina. Su correo y su RUT quedan libres. Esta acción no se puede deshacer."
        onConfirm={() => void run("delete", current => deleteEmployee(current, actor, employee.id, reason), goToList)}>
        <ReasonField value={reason} onChange={setReason} error={fieldError(error, "reason")} />
        <Field>
          <FieldLabel htmlFor="confirm-email">Escribe <strong>{employee.email}</strong> para confirmar</FieldLabel>
          <Input id="confirm-email" autoComplete="off" value={confirmEmail} onChange={event => setConfirmEmail(event.target.value)} />
        </Field>
      </Confirm>
    </div>
  );
}

function ReasonField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string | undefined }) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="action-reason">Motivo <span className="field-optional">(opcional)</span></FieldLabel>
      <Textarea id="action-reason" rows={3} maxLength={250} value={value} onChange={event => onChange(event.target.value)} placeholder="Ej.: término de contrato" />
      <FieldDescription>{value.length}/250 · queda en su registro.</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** An AlertDialog that stays open until the action answers, with the API's error inside it. */
function Confirm({ open, onClose, busy, error, title, description, confirmLabel, icon, onConfirm, disabled, tone = "destructive", children }: {
  open: boolean; onClose: () => void; busy: boolean; error: AccessError | null; title: string; description: string; confirmLabel: string; icon: ReactNode;
  onConfirm: () => void; disabled?: boolean | undefined; tone?: "destructive" | "default"; children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children && <FieldGroup className="confirm-fields">{children}</FieldGroup>}
        <ErrorAlert error={error && !error.details ? error : null} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
          <Button variant={tone === "destructive" ? "destructive" : "default"} disabled={busy || disabled} onClick={onConfirm}>{busy ? <Loader2 className="animate-spin" /> : icon}{confirmLabel}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
