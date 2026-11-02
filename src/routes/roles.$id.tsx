import { useState, type ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Pencil, ShieldAlert, ShieldX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, EmployeeStatusBadge, ErrorAlert, useActor } from "@/components/access/access-ui";
import { RoleDialog, RoleFields } from "@/components/access/role-form";
import { BackLink, Callout, EmptyState, Page, PageHeader, Panel, Split, Stack } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteRole, employeeStatus, findRole, fullName, roleLabel, roleLocks, roleMembers, type AccessError } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/roles/$id")({
  component: () => <AccessPage trail={["Recursos Humanos", "Personas y accesos", "Roles", "Detalle"]} title="Rol" permission="roles.read"><RolePage /></AccessPage>,
  head: () => ({ meta: [{ title: "Rol | Ecosistema X" }] }),
});

/** A header button that, when locked, keeps a tooltip saying why. */
function Locked({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span tabIndex={0} className="ds-icon-action-wrap">{children}</span></TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function RolePage() {
  const { id } = Route.useParams();
  const { state, actor } = useActor();
  const navigate = useNavigate();
  const role = findRole(state, id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);

  if (!role) {
    return (
      <Page>
        <BackLink to="/roles">Roles</BackLink>
        <EmptyState icon={<ShieldX aria-hidden="true" />} title="El rol no existe" action={<Button asChild variant="outline"><Link to="/roles">Ver roles</Link></Button>}>Puede que lo hayan eliminado.</EmptyState>
      </Page>
    );
  }
  const locks = roleLocks(state, role);
  const members = roleMembers(state, role.id);
  const draft = { name: role.name, description: role.description ?? "", permissions: role.permissions };

  return (
    <Page>
      <PageHeader
        back={<BackLink to="/roles">Roles</BackLink>}
        eyebrow="Rol"
        title={roleLabel(role)}
        description={role.description ?? "Sin descripción."}
        actions={<>
          <Locked reason={locks.edit}><Button variant="outline" disabled={locks.edit !== null} onClick={() => setEditing(true)}><Pencil />Editar rol</Button></Locked>
          <Locked reason={locks.remove}><Button variant="destructive" disabled={locks.remove !== null} onClick={() => { setError(null); setDeleting(true); }}><Trash2 />Eliminar rol</Button></Locked>
        </>}
      />
      <Stack>
      {role.isSystem && <Callout variant="note" icon={<ShieldAlert aria-hidden="true" />}>El rol Administrador es del sistema: siempre tiene todos los permisos y no se puede editar ni eliminar.</Callout>}
      <Split>
        <Panel>
          <RoleFields state={state} actor={actor} value={draft} onChange={() => undefined} readOnly error={null} idPrefix="role-view" />
        </Panel>
        <Panel as="aside" title="Empleados con este rol" className="role-members">
          {members.length === 0 ? <p className="text-sm text-muted-foreground">Nadie tiene este rol todavía.</p> : (
            <ul>
              {members.map(employee => (
                <li key={employee.id}>
                  <Link to="/empleados/$id" params={{ id: employee.id }} className="ds-link">{fullName(employee)}</Link>
                  <EmployeeStatusBadge status={employeeStatus(employee)} />
                </li>
              ))}
            </ul>
          )}
          {members.length > 0 && <Link to="/empleados" search={{ rol: role.id }} className="access-demo-link">Ver en el listado de empleados</Link>}
        </Panel>
      </Split>
      </Stack>

      <RoleDialog state={state} actor={actor} role={role} open={editing} onOpenChange={setEditing} />

      <AlertDialog open={deleting} onOpenChange={open => { if (!open && !busy) setDeleting(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el rol {role.name}?</AlertDialogTitle>
            <AlertDialogDescription>Su nombre queda libre para un rol nuevo. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorAlert error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={async () => {
              setBusy(true); setError(null);
              const outcome = await call(current => deleteRole(current, role.id));
              setBusy(false);
              if (!outcome.ok) { setError(outcome.error); return; }
              toast.success(outcome.message);
              await navigate({ to: "/roles" });
            }}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Eliminar rol</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
