import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Eye, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, AccessPagination, ErrorAlert, useActor } from "@/components/access/access-ui";
import { RoleDialog } from "@/components/access/role-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ActionButton } from "@/components/requests/request-list";
import { can, deleteRole, listRoles, roleLabel, roleLocks, roleMembers, type AccessError, type Role } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/roles/")({
  component: () => <AccessPage trail={["Recursos Humanos", "Personas y accesos", "Roles"]} title="Roles" permission="roles.read"><RolesPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Roles | Ecosistema X" }, { name: "description", content: "Roles de la plataforma y los permisos que otorga cada uno." }] }),
});

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
  const pageCount = Math.max(1, Math.ceil(roles.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = roles.slice((current - 1) * pageSize, current * pageSize);
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

  return (
    <div className="my-requests">
      <p className="eyebrow">PERSONAS Y ACCESOS</p>
      <div className="access-heading">
        <div>
          <h1 className="page-heading">Roles</h1>
          <p className="page-description">Un rol agrupa permisos. Cada empleado tiene uno o más roles y puede hacer lo que permite la suma de ellos.</p>
        </div>
        {manage && <Button onClick={() => setEditing(null)}><Plus />Nuevo rol</Button>}
      </div>

      <section className="filters-bar access-filters roles-filters" aria-label="Búsqueda">
        <div className="filter-field filter-search">
          <label htmlFor="role-search" className="filter-label">Buscar</label>
          <div className="search-input"><Search aria-hidden="true" /><Input id="role-search" type="search" placeholder="Nombre del rol" maxLength={50} value={term} onChange={event => { setTerm(event.target.value); setPage(1); }} /></div>
        </div>
        <Button asChild variant="outline" className="roles-matrix-link"><Link to="/permisos"><ShieldCheck />Ver permisos por rol</Link></Button>
      </section>

      <section className="requests-table-card" aria-label="Listado de roles">
        <Table className="requests-table access-table">
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="numeric-head">Permisos</TableHead>
              <TableHead className="numeric-head">Empleados</TableHead>
              <TableHead className="actions-head">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && <TableRow><TableCell colSpan={5} className="requests-empty">No hay roles con ese nombre.</TableCell></TableRow>}
            {visible.map(role => {
              const locks = roleLocks(state, role);
              return (
                <TableRow key={role.id}>
                  <TableCell><Link to="/roles/$id" params={{ id: role.id }} className="person-link">{roleLabel(role)}</Link></TableCell>
                  <TableCell className="role-description">{role.description ?? <span className="text-muted-foreground">Sin descripción</span>}</TableCell>
                  <TableCell className="numeric-cell">{role.permissions.length}</TableCell>
                  {/* Everyone with the role, invited people included: they also keep it from being deleted. */}
                  <TableCell className="numeric-cell"><Link to="/empleados" search={{ rol: role.id }} className="count-link" title="Ver sus empleados">{roleMembers(state, role.id).length}</Link></TableCell>
                  <TableCell>
                    <div className="row-actions">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild variant="ghost" size="icon" className="row-action"><Link to="/roles/$id" params={{ id: role.id }} aria-label={`Ver ${roleLabel(role)}`}><Eye /></Link></Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver</TooltipContent>
                      </Tooltip>
                      <ActionButton label={`Editar ${role.name}`} disabled={locks.edit !== null} reason={locks.edit ?? undefined} onClick={() => setEditing(role)}><Pencil /></ActionButton>
                      <ActionButton label={`Eliminar ${role.name}`} disabled={locks.remove !== null} reason={locks.remove ?? undefined} onClick={() => { setError(null); setDeleting(role); }}><Trash2 /></ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <AccessPagination page={current} pageSize={pageSize} totalCount={roles.length} onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />
      </section>

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
    </div>
  );
}
