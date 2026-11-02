import { type ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MailWarning, ShieldCheck, UserX } from "lucide-react";
import { AccessPage, EmployeeStatusBadge, formatDateTime, initials, useActor } from "@/components/access/access-ui";
import { actionMeta, availability, useEmployeeActions, useTicking, type EmployeeAction } from "@/components/access/employee-actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MAX_SENDS_PER_DAY, can, canResendAt, deliverable, emailStatusLabels, emailStatusOf, employeeStatus, findEmployee, findRole, formatPhone, formatRut, fullName,
  permissionCatalog, permissionsOf, roleLabel, withinScope, type AccessState,
} from "@/lib/access";

export const Route = createFileRoute("/empleados/$id")({
  component: () => <AccessPage trail={["Recursos Humanos", "Personas y accesos", "Empleados", "Detalle"]} title="Empleado" permission="employees.read"><EmployeeDetailPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Empleado | Ecosistema X" }] }),
});

function Item({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-item"><dt>{label}</dt><dd>{children}</dd></div>;
}

function PersonName({ state, id }: { state: AccessState; id: string | null }) {
  const person = id ? findEmployee(state, id) : undefined;
  if (!person) return <>{id ? "Usuario eliminado" : "El sistema"}</>;
  return <Link to="/empleados/$id" params={{ id: person.id }} className="person-link">{fullName(person)}</Link>;
}

const headerActions: EmployeeAction[] = ["resend", "email", "edit", "deactivate", "reactivate", "revoke", "delete"];

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const { state, actor } = useActor();
  const navigate = useNavigate();
  const employee = findEmployee(state, id);
  const actions = useEmployeeActions(state, actor, () => void navigate({ to: "/empleados" }));
  useTicking(employee ? canResendAt(employee) !== null : false);

  if (!employee) {
    return (
      <div className="my-requests">
        <Link to="/empleados" className="access-back"><ArrowLeft aria-hidden="true" />Empleados</Link>
        <div className="access-empty"><UserX aria-hidden="true" /><h2>El empleado no existe</h2><p>Puede que lo hayan eliminado o que su invitación se haya cancelado.</p><Button asChild variant="outline"><Link to="/empleados">Ver empleados</Link></Button></div>
      </div>
    );
  }

  const status = employeeStatus(employee);
  const isSelf = employee.id === actor.id;
  const scoped = withinScope(state, actor, employee);
  const invitation = employee.invitation;
  const mailStatus = invitation ? emailStatusOf(invitation) : null;
  const mailOk = mailStatus ? deliverable(mailStatus) : true;
  const sendsToday = invitation ? invitation.sends.filter(time => Date.parse(time) > Date.now() - 86_400_000).length : 0;
  const permissions = permissionsOf(state, employee);
  const wait = canResendAt(employee);

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
      <div className="employee-actions" aria-label="Acciones">
        {headerActions.map(action => {
          const { visible, allowed, reason } = availability(state, actor, employee, action);
          if (!visible) return null;
          const meta = actionMeta[action];
          const label = action === "resend" && wait ? `Reenviar en ${Math.max(1, Math.ceil((Date.parse(wait) - Date.now()) / 1000))} s` : meta.label;
          const button = <Button variant={meta.danger && action !== "deactivate" ? "destructive" : "outline"} disabled={!allowed || actions.busy !== null} onClick={() => actions.start(action, employee)}>{meta.icon}{label}</Button>;
          // A locked action keeps a tooltip that says why.
          return allowed ? <span key={action}>{button}</span> : (
            <Tooltip key={action}>
              <TooltipTrigger asChild><span tabIndex={0} className="action-wrapper">{button}</span></TooltipTrigger>
              <TooltipContent>{reason}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="detail-grid">
        <section className="access-card">
          <h2 className="access-card-title">Datos personales</h2>
          <dl className="detail-list">
            <Item label="Nombre">{employee.firstName}</Item>
            <Item label="Apellidos">{employee.lastName}</Item>
            <Item label="RUT">{formatRut(employee.rut)}</Item>
            <Item label="Correo">{employee.email}</Item>
            <Item label="Teléfono">{formatPhone(employee.phone)}</Item>
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
                {can(state, "roles.read") ? <Link to="/roles/$id" params={{ id: role!.id }} className="role-chip link">{roleLabel(role!)}</Link> : <span className="role-chip">{roleLabel(role!)}</span>}
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
            <Item label="Fecha de registro">{formatDateTime(employee.createdAt)}</Item>
            <Item label="Invitado por"><PersonName state={state} id={employee.createdBy} /></Item>
          </dl>
        </section>
      </div>

      {actions.dialogs}
    </div>
  );
}
