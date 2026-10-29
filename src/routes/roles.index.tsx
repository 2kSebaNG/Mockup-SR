import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, ErrorAlert, useActor } from "@/components/access/access-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ActionButton } from "@/components/requests/request-list";
import { can, deleteRole, listRoles, roleMembers, roleUserCount, type AccessError, type Role } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/roles/")({
  component: () => <AccessPage trail={["Personas y accesos", "Roles"]} title="Roles" permission="roles.read"><RolesPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Roles | Ecosistema X" }, { name: "description", content: "Roles de la plataforma y los permisos que otorga cada uno." }] }),
});

function RolesPage() {
  const { state } = useActor();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  const roles = listRoles(state, term);
  const manage = can(state, "roles.manage");

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    const outcome = await call(current => deleteRole(current, deleting.id));
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
        {manage && <Button asChild><Link to="/roles/nuevo"><Plus />Nuevo rol</Link></Button>}
      </div>

      <section className="filters-bar access-filters roles-filters" aria-label="Búsqueda">
        <div className="filter-field filter-search">
          <label htmlFor="role-search" className="filter-label">Buscar</label>
          <div className="search-input"><Search aria-hidden="true" /><Input id="role-search" type="search" placeholder="Nombre del rol" maxLength={50} value={term} onChange={event => setTerm(event.target.value)} /></div>
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
            {roles.length === 0 && <TableRow><TableCell colSpan={5} className="requests-empty">No hay roles con ese nombre.</TableCell></TableRow>}
            {roles.map(role => {
              const pending = roleMembers(state, role.id).length - roleUserCount(state, role.id);
              return (
                <TableRow key={role.id}>
                  <TableCell><span className="person-cell"><Link to="/roles/$id" params={{ id: role.id }} className="person-link">{role.name}</Link>{role.isSystem && <span className="system-badge">Sistema</span>}</span></TableCell>
                  <TableCell className="role-description">{role.description ?? <span className="text-muted-foreground">Sin descripción</span>}</TableCell>
                  <TableCell className="numeric-cell">{role.permissions.length}</TableCell>
                  <TableCell className="numeric-cell">
                    <Link to="/empleados" search={{ rol: role.id }} className="count-link" title="Ver sus empleados">{roleUserCount(state, role.id)}</Link>
                    {pending > 0 && <span className="person-meta">+{pending} {pending === 1 ? "invitado" : "invitados"}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="row-actions">
                      <ActionButton label={manage && !role.isSystem ? `Editar ${role.name}` : `Ver ${role.name}`} onClick={() => void navigate({ to: "/roles/$id", params: { id: role.id } })}><Pencil /></ActionButton>
                      {manage && <ActionButton label={`Eliminar ${role.name}`} disabled={role.isSystem} reason="El rol Administrador es del sistema" onClick={() => { setError(null); setDeleting(role); }}><Trash2 /></ActionButton>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <AlertDialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el rol {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Su nombre queda libre para un rol nuevo. Solo se puede eliminar un rol que nadie tiene, ni siquiera un invitado.</AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorAlert error={error} />
          {error?.code === "ROLE_IN_USE" && deleting && <Link to="/empleados" search={{ rol: deleting.id }} className="access-demo-link">Ver los empleados con este rol</Link>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Eliminar rol</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
