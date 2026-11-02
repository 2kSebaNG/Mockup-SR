import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Eye, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, AccessPagination, ErrorAlert, useActor } from "@/components/access/access-ui";
import { RoleDialog } from "@/components/access/role-form";
import { Actions, DataList, FilterBar, FilterField, IconAction, Page, PageHeader, SearchInput, paginate, type DataColumn } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { can, deleteRole, listRoles, roleLabel, roleLocks, roleMembers, type AccessError, type AccessState, type Role } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/roles/")({
  component: () => <AccessPage trail={["Recursos Humanos", "Personas y accesos", "Roles"]} title="Roles" permission="roles.read"><RolesPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Roles | Ecosistema X" }, { name: "description", content: "Roles de la plataforma y los permisos que otorga cada uno." }] }),
});

const columns = (state: AccessState): DataColumn<Role>[] => [
  { key: "name", header: "Rol", card: "title", cell: role => <Link to="/roles/$id" params={{ id: role.id }} className="ds-link">{roleLabel(role)}</Link> },
  { key: "description", header: "Descripción", card: "title", className: "role-description", cell: role => <span className="text-muted-foreground">{role.description ?? "Sin descripción"}</span> },
  { key: "permissions", header: "Permisos", align: "end", cell: role => role.permissions.length },
  // Everyone with the role, invited people included: they also keep it from being deleted.
  { key: "members", header: "Empleados", align: "end", cell: role => <Link to="/empleados" search={{ rol: role.id }} className="ds-link" title="Ver sus empleados">{roleMembers(state, role.id).length}</Link> },
];

function RolesPage() {
  const { state, actor } = useActor();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Role | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  const roles = listRoles(state, term);
  const { current, visible } = paginate(roles, page, pageSize);
  const manage = can(state, "roles.manage");

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    const outcome = await call(state => deleteRole(state, deleting.id));
    setBusy(false);
    if (!outcome.ok) { setError(outcome.error); return; }
    toast.success(outcome.message);
    setDeleting(null);
  };

  const actions = (role: Role) => {
    const locks = roleLocks(state, role);
    return (
      <Actions>
        <IconAction label="Ver" asChild><Link to="/roles/$id" params={{ id: role.id }} aria-label={`Ver ${roleLabel(role)}`}><Eye /></Link></IconAction>
        <IconAction label={`Editar ${role.name}`} disabled={locks.edit !== null} reason={locks.edit} onClick={() => setEditing(role)}><Pencil /></IconAction>
        <IconAction label={`Eliminar ${role.name}`} danger disabled={locks.remove !== null} reason={locks.remove} onClick={() => { setError(null); setDeleting(role); }}><Trash2 /></IconAction>
      </Actions>
    );
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Personas y accesos"
        title="Roles"
        description="Un rol agrupa permisos. Cada empleado tiene uno o más roles y puede hacer lo que permite la suma de ellos."
        actions={manage && <Button onClick={() => setEditing(null)}><Plus />Nuevo rol</Button>}
      />

      <FilterBar label="Búsqueda" end={<Button asChild variant="outline"><Link to="/permisos"><ShieldCheck />Ver permisos por rol</Link></Button>}>
        <FilterField id="role-search" label="Buscar" grow>
          <SearchInput id="role-search" placeholder="Nombre del rol" maxLength={50} value={term} onChange={event => { setTerm(event.target.value); setPage(1); }} />
        </FilterField>
      </FilterBar>

      <DataList
        label="Listado de roles"
        rows={visible}
        columns={columns(state)}
        rowKey={role => role.id}
        actions={actions}
        empty="No hay roles con ese nombre."
        footer={<AccessPagination page={current} pageSize={pageSize} totalCount={roles.length} onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />}
      />

      <RoleDialog state={state} actor={actor} role={editing ?? undefined} open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} />

      <AlertDialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el rol {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Su nombre queda libre para un rol nuevo. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorAlert error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Eliminar rol</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
