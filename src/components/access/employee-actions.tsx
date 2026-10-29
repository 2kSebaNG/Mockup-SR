import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AtSign, Eye, Loader2, MailX, MoreHorizontal, Pencil, Send, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { ErrorAlert, fieldError } from "@/components/access/access-ui";
import { EmployeeForm } from "@/components/access/employee-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActionButton } from "@/components/requests/request-list";
import {
  can, canResendAt, changeEmail, createEmployee, deactivateEmployee, deleteEmployee, deliverable, emailStatusOf, employeeStatus, fullName, permissionName,
  reactivateEmployee, resendInvitation, revokeInvitation, updateEmployee, withinScope, type AccessError, type AccessState, type Employee, type PermissionCode, type Step,
} from "@/lib/access";
import { call } from "@/lib/access-store";

export type EmployeeAction = "edit" | "deactivate" | "reactivate" | "resend" | "email" | "revoke" | "delete";
/** Whether an action can be used on an employee now, and if not, why (shown in its tooltip). */
export type Availability = { visible: boolean; allowed: boolean; reason?: string };

export const actionMeta: Record<EmployeeAction, { label: string; icon: ReactNode; danger?: boolean }> = {
  edit: { label: "Editar", icon: <Pencil /> },
  deactivate: { label: "Desactivar", icon: <UserX />, danger: true },
  reactivate: { label: "Reactivar", icon: <UserCheck /> },
  resend: { label: "Reenviar invitación", icon: <Send /> },
  email: { label: "Cambiar correo", icon: <AtSign /> },
  revoke: { label: "Cancelar invitación", icon: <MailX />, danger: true },
  delete: { label: "Eliminar", icon: <Trash2 />, danger: true },
};

const required: Record<EmployeeAction, PermissionCode> = {
  edit: "employees.manage", deactivate: "employees.deactivate", reactivate: "employees.deactivate",
  resend: "employees.invite", email: "employees.invite", revoke: "employees.invite", delete: "employees.delete",
};

/** The same rules the API applies, in its order: permission ⇒ not yourself ⇒ scope ⇒ the action's own state. */
export function availability(state: AccessState, actor: Employee, employee: Employee, action: EmployeeAction, now = Date.now()): Availability {
  const status = employeeStatus(employee, now);
  const pending = status === "pending" || status === "expired";
  const visible = {
    edit: true, deactivate: status === "active", reactivate: status === "deactivated",
    resend: pending, email: pending, revoke: pending, delete: !pending,
  }[action];
  if (!visible) return { visible, allowed: false };
  if (!can(state, required[action])) return { visible, allowed: false, reason: `Necesitas el permiso «${permissionName(required[action])}»` };
  if (employee.id === actor.id) return { visible, allowed: false, reason: "No puedes modificar tu propia cuenta" };
  if (!withinScope(state, actor, employee)) return { visible, allowed: false, reason: "Tiene permisos que tú no tienes" };
  if (action === "resend" && employee.invitation && !deliverable(emailStatusOf(employee.invitation, now))) return { visible, allowed: false, reason: "El correo no llega a esa dirección: cámbialo para reenviar" };
  if (action === "resend" || action === "email") {
    const at = canResendAt(employee, now);
    if (at) return { visible, allowed: false, reason: `Podrás enviarla de nuevo en ${Math.max(1, Math.ceil((Date.parse(at) - now) / 1000))} s` };
  }
  return { visible, allowed: true };
}

/** Re-renders every second while some invitation waits out its cooldown, so the locks and countdowns move. */
export function useTicking(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setTick(tick => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
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

/**
 * Every action on an employee, for the list and the detail alike: `start` opens its dialog (or, for resending, just
 * sends), and `dialogs` renders them. Removing an employee (cancelling the invitation or deleting) calls `onRemoved`.
 */
export function useEmployeeActions(state: AccessState, actor: Employee, onRemoved?: () => void) {
  const [target, setTarget] = useState<{ action: EmployeeAction; employee: Employee } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AccessError | null>(null);
  const [reason, setReason] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const reset = () => { setTarget(null); setError(null); setReason(""); setConfirmEmail(""); };
  const close = () => { if (!busy) reset(); };
  async function run<T>(key: string, operation: (current: AccessState) => Step<T>, after?: () => void) {
    setBusy(key); setError(null);
    const outcome = await call(operation);
    setBusy(null);
    if (!outcome.ok) {
      if (key === "resend") toast.error(outcome.error.message); else setError(outcome.error);
      return;
    }
    toast.success(outcome.message);
    reset();
    after?.();
  }

  const start = (action: EmployeeAction, employee: Employee) => {
    if (!availability(state, actor, employee, action).allowed) return;
    if (action === "resend") { void run(`resend-${employee.id}`, current => resendInvitation(current, actor, employee.id)); return; }
    setError(null);
    if (action === "email") setNewEmail(employee.email);
    setTarget({ action, employee });
  };
  // The dialog reads the employee from the state, so it shows what the last action left.
  const open = (action: EmployeeAction) => (target?.action === action ? state.employees.find(employee => employee.id === target.employee.id) ?? target.employee : null);
  const editing = open("edit"), emailing = open("email"), revoking = open("revoke"), deactivating = open("deactivate"), reactivating = open("reactivate"), deleting = open("delete");


  const dialogs = (
    <>
      <Dialog open={editing !== null} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="access-dialog wide">
          {editing && (
            <DialogBody>
              <DialogHeader>
                <DialogTitle>Editar a {fullName(editing)}</DialogTitle>
                <DialogDescription>Los roles nuevos rigen desde su siguiente acción en la plataforma.</DialogDescription>
              </DialogHeader>
              <EmployeeForm state={state} actor={actor} employee={editing} submitLabel="Guardar cambios" busyLabel="Guardando…" busy={busy === "edit"} error={error} onCancel={close}
                onSubmit={input => void run("edit", current => updateEmployee(current, actor, editing.id, input))} />
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={emailing !== null} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="access-dialog">
          {emailing && <>
            <DialogHeader>
              <DialogTitle>Cambiar el correo de {emailing.firstName}</DialogTitle>
              <DialogDescription>Le enviaremos una invitación nueva a esta dirección; el enlace anterior deja de funcionar.</DialogDescription>
            </DialogHeader>
            <form noValidate onSubmit={event => { event.preventDefault(); void run("email", current => changeEmail(current, actor, emailing.id, newEmail)); }}>
              <FieldGroup>
                <ErrorAlert error={error && !error.details ? error : null} />
                <Field data-invalid={Boolean(fieldError(error, "email"))}>
                  <FieldLabel htmlFor="new-email">Correo nuevo</FieldLabel>
                  <Input id="new-email" type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} aria-invalid={Boolean(fieldError(error, "email"))} />
                  <FieldError>{fieldError(error, "email")}</FieldError>
                </Field>
                <div className="access-form-actions">
                  <Button type="button" variant="outline" disabled={busy !== null} onClick={close}>Cancelar</Button>
                  <Button type="submit" disabled={busy !== null}>{busy === "email" ? <Loader2 className="animate-spin" /> : <Send />}Guardar y reenviar</Button>
                </div>
              </FieldGroup>
            </form>
          </>}
        </DialogContent>
      </Dialog>

      <Confirm open={revoking !== null} onClose={close} busy={busy === "revoke"} error={error} title={`¿Cancelar la invitación de ${revoking?.firstName ?? ""}?`} confirmLabel="Cancelar invitación" icon={<MailX />}
        description="El enlace deja de funcionar y el empleado se elimina. Su correo y su RUT quedan libres para invitarlo de nuevo."
        onConfirm={() => revoking && void run("revoke", current => revokeInvitation(current, actor, revoking.id), onRemoved)} />

      <Confirm open={deactivating !== null} onClose={close} busy={busy === "deactivate"} error={error} title={`¿Desactivar a ${deactivating ? fullName(deactivating) : ""}?`} confirmLabel="Desactivar" icon={<UserX />}
        description="Sus sesiones se cierran de inmediato y no podrá entrar ni con contraseña ni con Microsoft. Puedes reactivarlo cuando quieras: conserva sus roles."
        onConfirm={() => deactivating && void run("deactivate", current => deactivateEmployee(current, actor, deactivating.id, reason))}>
        <ReasonField value={reason} onChange={setReason} error={fieldError(error, "reason")} />
      </Confirm>

      <Confirm open={reactivating !== null} onClose={close} busy={busy === "reactivate"} error={error} title={`¿Reactivar a ${reactivating ? fullName(reactivating) : ""}?`} confirmLabel="Reactivar" icon={<UserCheck />} tone="default"
        description="Podrá volver a entrar con sus mismos roles y su misma contraseña."
        onConfirm={() => reactivating && void run("reactivate", current => reactivateEmployee(current, actor, reactivating.id))} />

      <Confirm open={deleting !== null} onClose={close} busy={busy === "delete"} error={error} title={`¿Eliminar a ${deleting ? fullName(deleting) : ""}?`} confirmLabel="Eliminar definitivamente" icon={<Trash2 />}
        disabled={!deleting || confirmEmail.trim().toLowerCase() !== deleting.email}
        description="Sus sesiones se cierran y su cuenta se elimina. Su correo y su RUT quedan libres. Esta acción no se puede deshacer."
        onConfirm={() => deleting && void run("delete", current => deleteEmployee(current, actor, deleting.id, reason), onRemoved)}>
        <ReasonField value={reason} onChange={setReason} error={fieldError(error, "reason")} />
        <Field>
          <FieldLabel htmlFor="confirm-email">Escribe <strong>{deleting?.email}</strong> para confirmar</FieldLabel>
          <Input id="confirm-email" autoComplete="off" value={confirmEmail} onChange={event => setConfirmEmail(event.target.value)} />
        </Field>
      </Confirm>
    </>
  );
  return { start, dialogs, busy };
}

/** "Invitar empleado" in a modal; the toast offers to open the new employee. */
export function InviteEmployeeDialog({ state, actor, open, onOpenChange }: { state: AccessState; actor: Employee; open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  const [round, setRound] = useState(0);
  // A fresh form each time it opens.
  useEffect(() => { if (open) { setError(null); setRound(value => value + 1); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="access-dialog wide">
        <DialogBody>
          <DialogHeader>
            <DialogTitle>Invitar empleado</DialogTitle>
            <DialogDescription>Recibirá un correo para aceptar los términos y entrar con contraseña o con Microsoft.</DialogDescription>
          </DialogHeader>
          <EmployeeForm key={round} state={state} actor={actor} submitLabel="Invitar empleado" busyLabel="Invitando…" busy={busy} error={error} onCancel={() => onOpenChange(false)}
            onSubmit={async input => {
              setBusy(true); setError(null);
              const outcome = await call(current => createEmployee(current, actor, input));
              setBusy(false);
              if (!outcome.ok) { setError(outcome.error); return; }
              onOpenChange(false);
              const id = outcome.data.id;
              toast.success(outcome.message, { description: `Enviamos la invitación a ${outcome.data.email}.`, action: { label: "Ver", onClick: () => void navigate({ to: "/empleados/$id", params: { id } }) } });
            }} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A row's actions: see and edit always, then what the status allows. An active or deactivated employee has one more
 * (deactivate or reactivate); a pending invitation has three (resend, change email, cancel), gathered under "…".
 * Locked actions stay visible, disabled, and their tooltip says why.
 */
export function EmployeeRowActions({ state, actor, employee, onAction }: { state: AccessState; actor: Employee; employee: Employee; onAction: (action: EmployeeAction, employee: Employee) => void }) {
  const now = Date.now();
  const name = fullName(employee);
  const check = (action: EmployeeAction) => availability(state, actor, employee, action, now);
  const inline = (["edit", "deactivate", "reactivate"] as const).filter(action => check(action).visible);
  const menu = (["resend", "email", "revoke"] as const).filter(action => check(action).visible);
  return (
    <div className="row-actions">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="row-action"><Link to="/empleados/$id" params={{ id: employee.id }} aria-label={`Ver a ${name}`}><Eye /></Link></Button>
        </TooltipTrigger>
        <TooltipContent>Ver</TooltipContent>
      </Tooltip>
      {inline.map(action => {
        const { allowed, reason } = check(action);
        return (
          <ActionButton key={action} label={`${actionMeta[action].label} a ${name}`} disabled={!allowed} reason={reason} onClick={() => onAction(action, employee)}>
            {actionMeta[action].icon}
          </ActionButton>
        );
      })}
      {menu.length > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="row-action" aria-label={`Invitación de ${name}`}><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Invitación</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="row-menu">
            <DropdownMenuLabel>Invitación de {employee.firstName}</DropdownMenuLabel>
            {menu.map(action => {
              const { allowed, reason } = check(action);
              return (
                <DropdownMenuItem key={action} disabled={!allowed} className={actionMeta[action].danger ? "danger" : undefined} onSelect={() => onAction(action, employee)}>
                  {actionMeta[action].icon}
                  <span className="row-menu-text">{actionMeta[action].label}{!allowed && reason && <span>{reason}</span>}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
