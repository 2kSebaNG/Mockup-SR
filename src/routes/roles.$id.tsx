import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldAlert, ShieldX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, EmployeeStatusBadge, ErrorAlert, useActor } from "@/components/access/access-ui";
import { RoleForm } from "@/components/access/role-form";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { can, deleteRole, employeeStatus, findRole, fullName, roleMembers, updateRole, type AccessError } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/roles/$id")({
  component: () => <AccessPage trail={["Personas y accesos", "Roles", "Detalle"]} title="Rol" permission="roles.read"><RolePage /></AccessPage>,
  head: () => ({ meta: [{ title: "Rol | Ecosistema X" }] }),
});

function RolePage() {
  const { id } = Route.useParams();
  const { state, actor } = useActor();
  const navigate = useNavigate();
  const role = findRole(state, id);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<AccessError | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<AccessError | null>(null);

  if (!role) {
    return (
      <div className="my-requests">
        <Link to="/roles" className="access-back"><ArrowLeft aria-hidden="true" />Roles</Link>
        <div className="access-empty"><ShieldX aria-hidden="true" /><h2>El rol no existe</h2><p>Puede que lo hayan eliminado.</p><Button asChild variant="outline"><Link to="/roles">Ver roles</Link></Button></div>
      </div>
    );
  }
  const manage = can(state, "roles.manage");
  const readOnly = role.isSystem || !manage;
  const members = roleMembers(state, role.id);

  return (
    <div className="my-requests">
      <Link to="/roles" className="access-back"><ArrowLeft aria-hidden="true" />Roles</Link>
      <p className="eyebrow">ROL{role.isSystem ? " DEL SISTEMA" : ""}</p>
      <div className="access-heading">
        <div>
          <h1 className="page-heading">{role.name}</h1>
          <p className="page-description">{readOnly ? "Revisa qué permite este rol y quién lo tiene." : "Edita su nombre, su descripción y sus permisos. Los cambios rigen desde la siguiente acción de cada empleado."}</p>
        </div>
        {manage && !role.isSystem && <Button variant="destructive" disabled={busy !== null} onClick={() => { setDeleteError(null); setDeleting(true); }}><Trash2 />Eliminar rol</Button>}
      </div>
      {role.isSystem && <p className="requests-note access-note"><ShieldAlert aria-hidden="true" />El rol Administrador es del sistema: siempre tiene todos los permisos y no se puede editar ni eliminar.</p>}

      <div className="role-layout">
        <RoleForm key={`${role.id}-${role.name}-${role.permissions.join()}`} state={state} actor={actor} role={role} readOnly={readOnly} busy={busy === "save"} error={error} submitLabel="Guardar cambios"
          onCancel={() => void navigate({ to: "/roles" })}
          onSubmit={async input => {
            setBusy("save"); setError(null);
            const outcome = await call(current => updateRole(current, actor, role.id, input));
            setBusy(null);
            if (outcome.ok) toast.success(outcome.message); else setError(outcome.error);
          }} />
        <aside className="access-card role-members">
          <h2 className="access-card-title">Empleados con este rol</h2>
          {members.length === 0 ? <p className="text-sm text-muted-foreground">Nadie tiene este rol todavía.</p> : (
            <ul>
              {members.map(employee => (
                <li key={employee.id}>
                  <Link to="/empleados/$id" params={{ id: employee.id }} className="person-link">{fullName(employee)}</Link>
                  <EmployeeStatusBadge status={employeeStatus(employee)} />
                </li>
              ))}
            </ul>
          )}
          {members.length > 0 && <Link to="/empleados" search={{ rol: role.id }} className="access-demo-link">Ver en el listado de empleados</Link>}
        </aside>
      </div>

      <AlertDialog open={deleting} onOpenChange={open => { if (!open && busy === null) setDeleting(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el rol {role.name}?</AlertDialogTitle>
            <AlertDialogDescription>Su nombre queda libre para un rol nuevo. Solo se puede eliminar un rol que nadie tiene, ni siquiera un invitado.</AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorAlert error={deleteError} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={busy !== null} onClick={async () => {
              setBusy("delete"); setDeleteError(null);
              const outcome = await call(current => deleteRole(current, role.id));
              setBusy(null);
              if (!outcome.ok) { setDeleteError(outcome.error); return; }
              toast.success(outcome.message);
              await navigate({ to: "/roles" });
            }}>{busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}Eliminar rol</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
