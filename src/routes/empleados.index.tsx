import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Search, UserPlus, X } from "lucide-react";
import { AccessPage, AccessPagination, EmployeeStatusBadge, formatDay, useActor } from "@/components/access/access-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PAGE_SIZES, can, employeeStatus, findRole, formatRut, fullName, listEmployees, listRoles, statusLabels, type EmployeeQuery, type EmployeeStatus } from "@/lib/access";

type Sort = NonNullable<EmployeeQuery["sort"]>;
type EmployeesSearch = { buscar?: string | undefined; estado?: EmployeeStatus | undefined; rol?: string | undefined; orden?: Sort | undefined; dir?: "desc" | undefined; pagina?: number | undefined; filas?: number | undefined };
const statuses = Object.keys(statusLabels) as EmployeeStatus[];
const sorts: Sort[] = ["name", "email", "createdAt", "status"];

export const Route = createFileRoute("/empleados/")({
  // The list's filters live in the URL, so a filtered list can be shared and survives going back from a detail.
  validateSearch: (search: Record<string, unknown>): EmployeesSearch => {
    const page = Number(search["pagina"]);
    const size = Number(search["filas"]);
    return {
      ...(typeof search["buscar"] === "string" && search["buscar"] && { buscar: search["buscar"].slice(0, 100) }),
      ...(statuses.includes(search["estado"] as EmployeeStatus) && { estado: search["estado"] as EmployeeStatus }),
      ...(typeof search["rol"] === "string" && { rol: search["rol"] }),
      ...(sorts.includes(search["orden"] as Sort) && search["orden"] !== "name" && { orden: search["orden"] as Sort }),
      ...(search["dir"] === "desc" && { dir: "desc" as const }),
      ...(Number.isInteger(page) && page > 1 && { pagina: page }),
      ...(PAGE_SIZES.includes(size as 5) && size !== 10 && { filas: size }),
    };
  },
  component: () => <AccessPage trail={["Personas y accesos", "Empleados"]} title="Empleados" permission="employees.read"><EmployeesPage /></AccessPage>,
  head: () => ({ meta: [{ title: "Empleados | Ecosistema X" }, { name: "description", content: "Empleados de la empresa: invitaciones, estado de su acceso y roles." }] }),
});

const sortLabels: Record<Sort, string> = { name: "Nombre", email: "Correo", createdAt: "Alta", status: "Estado" };

function EmployeesPage() {
  const { state } = useActor();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (change: Partial<EmployeesSearch>, keepPage = false) =>
    void navigate({ search: prev => { const next = { ...prev, ...change }; if (!keepPage) delete next.pagina; return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as EmployeesSearch; }, replace: true });

  // Typing waits 300 ms before it filters, as the list would query the API.
  const [term, setTerm] = useState(search.buscar ?? "");
  useEffect(() => {
    const timer = window.setTimeout(() => { if ((search.buscar ?? "") !== term.trim()) setSearch({ buscar: term.trim() || undefined }); }, 300);
    return () => window.clearTimeout(timer);
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  const sort = search.orden ?? "name";
  const direction = search.dir ?? "asc";
  const page = useMemo(() => listEmployees(state, { search: search.buscar, status: search.estado, roleId: search.rol, sort, direction, page: search.pagina, pageSize: search.filas }), [state, search, sort, direction]);
  const roles = listRoles(state);
  const filtered = Boolean(search.buscar || search.estado || search.rol);

  const SortHead = ({ column }: { column: Sort }) => {
    const active = sort === column;
    const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className={`sort-button${active ? " active" : ""}`} onClick={() => setSearch({ orden: column === "name" ? undefined : column, dir: active && direction === "asc" ? "desc" : undefined })}>
          {sortLabels[column]}<Icon />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="my-requests">
      <p className="eyebrow">PERSONAS Y ACCESOS</p>
      <div className="access-heading">
        <div>
          <h1 className="page-heading">Empleados</h1>
          <p className="page-description">Invita a las personas de la empresa, sigue sus invitaciones y gestiona su acceso y sus roles.</p>
        </div>
        {can(state, "employees.invite") && <Button asChild><Link to="/empleados/nuevo"><UserPlus />Invitar empleado</Link></Button>}
      </div>

      <section className="filters-bar access-filters" aria-label="Búsqueda y filtros">
        <div className="filter-field filter-search">
          <label htmlFor="employee-search" className="filter-label">Buscar</label>
          <div className="search-input"><Search aria-hidden="true" /><Input id="employee-search" type="search" placeholder="Nombre, correo o RUT" value={term} maxLength={100} onChange={event => setTerm(event.target.value)} /></div>
        </div>
        <div className="filter-field">
          <span id="employee-status" className="filter-label">Estado</span>
          <Select value={search.estado ?? "todos"} onValueChange={value => setSearch({ estado: value === "todos" ? undefined : value as EmployeeStatus })}>
            <SelectTrigger aria-labelledby="employee-status" className="filter-trigger"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{statuses.map(status => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="filter-field">
          <span id="employee-role" className="filter-label">Rol</span>
          <Select value={search.rol ?? "todos"} onValueChange={value => setSearch({ rol: value === "todos" ? undefined : value })}>
            <SelectTrigger aria-labelledby="employee-role" className="filter-trigger"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {filtered && <Button variant="ghost" className="filter-clear" onClick={() => { setTerm(""); setSearch({ buscar: undefined, estado: undefined, rol: undefined }); }}><X />Limpiar filtros</Button>}
      </section>

      <section className="requests-table-card" aria-label="Listado de empleados">
        <Table className="requests-table access-table">
          <TableHeader>
            <TableRow>
              <SortHead column="name" />
              <SortHead column="email" />
              <TableHead>Roles</TableHead>
              <SortHead column="status" />
              <SortHead column="createdAt" />
              <TableHead className="actions-head">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="requests-empty">{filtered ? "No hay empleados que coincidan con la búsqueda o los filtros." : "Todavía no hay empleados. Invita al primero."}</TableCell></TableRow>
            )}
            {page.items.map(employee => (
              <TableRow key={employee.id}>
                <TableCell>
                  <span className="person-cell">
                    <Link to="/empleados/$id" params={{ id: employee.id }} className="person-link">{fullName(employee)}</Link>
                    <span className="person-meta">{formatRut(employee.rut)}</span>
                  </span>
                </TableCell>
                <TableCell className="email-cell">{employee.email}</TableCell>
                <TableCell><span className="role-chips">{employee.roleIds.map(id => findRole(state, id)).filter(Boolean).map(role => <span key={role!.id} className="role-chip">{role!.name}</span>)}</span></TableCell>
                <TableCell><EmployeeStatusBadge status={employeeStatus(employee)} /></TableCell>
                <TableCell className="request-date">{formatDay(employee.createdAt)}</TableCell>
                <TableCell>
                  <div className="row-actions">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant="ghost" size="icon" className="row-action"><Link to="/empleados/$id" params={{ id: employee.id }} aria-label={`Ver a ${fullName(employee)}`}><Eye /></Link></Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalle</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <AccessPagination page={page.page} pageSize={page.pageSize} totalCount={page.totalCount}
          onPage={next => setSearch({ pagina: next > 1 ? next : undefined }, true)} onPageSize={size => setSearch({ filas: size === 10 ? undefined : size })} />
      </section>
    </div>
  );
}
