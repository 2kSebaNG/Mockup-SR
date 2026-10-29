import { Fragment } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Info, Minus } from "lucide-react";
import { AccessPage, useActor } from "@/components/access/access-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listRoles, permissionCatalog, roleLabel, permissionsOf, type PermissionCode } from "@/lib/access";

export const Route = createFileRoute("/permisos")({
  component: () => <AccessPage trail={["Recursos Humanos", "Personas y accesos", "Permisos"]} title="Permisos" permission="roles.read"><PermissionsPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Permisos | Ecosistema X" }, { name: "description", content: "El catálogo de permisos y qué roles otorgan cada uno." }] }),
});

/** The fixed catalog of permissions, as rows, against every role, as columns: who can do what at a glance. */
function PermissionsPage() {
  const { state, actor } = useActor();
  const roles = listRoles(state);
  const mine = new Set(permissionsOf(state, actor));
  return (
    <div className="my-requests">
      <p className="eyebrow">PERSONAS Y ACCESOS</p>
      <h1 className="page-heading">Permisos</h1>
      <p className="page-description">Cada acción de la plataforma exige un permiso. Aquí ves el catálogo completo y qué roles otorgan cada permiso; para cambiarlo, edita el rol.</p>

      <section className="requests-table-card" aria-label="Permisos por rol">
        <Table className="requests-table permission-matrix">
          <TableHeader>
            <TableRow>
              <TableHead className="matrix-permission">Permiso</TableHead>
              {roles.map(role => <TableHead key={role.id} className="matrix-role"><Link to="/roles/$id" params={{ id: role.id }} className="person-link">{roleLabel(role)}</Link></TableHead>)}
              <TableHead className="matrix-role">Tú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissionCatalog.map(group => (
              <Fragment key={group.key}>
                <TableRow className="matrix-group"><TableCell colSpan={roles.length + 2}>{group.name}</TableCell></TableRow>
                {group.permissions.map(permission => {
                  const code = permission.code as PermissionCode;
                  return (
                    <TableRow key={code}>
                      <TableCell className="matrix-permission"><strong>{permission.name}</strong><span>{permission.description}</span></TableCell>
                      {roles.map(role => (
                        <TableCell key={role.id} className="matrix-cell">
                          {role.permissions.includes(code) ? <Check aria-label={`${role.name}: sí`} className="matrix-yes" /> : <Minus aria-label={`${role.name}: no`} className="matrix-no" />}
                        </TableCell>
                      ))}
                      <TableCell className="matrix-cell">{mine.has(code) ? <Check aria-label="Tú: sí" className="matrix-yes" /> : <Minus aria-label="Tú: no" className="matrix-no" />}</TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </section>
      <p className="requests-note"><Info aria-hidden="true" />El catálogo de permisos viene definido por el sistema y no se edita desde aquí. Los permisos rigen al instante: si un rol pierde uno, quienes lo tienen dejan de poder usarlo en su siguiente acción.</p>
    </div>
  );
}
