import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SquareArrowOutUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InternalChat, type ChatTarget } from "@/components/internal-chat";
import { AdminRequestDetail } from "@/components/requests/admin-request-dialogs";
import { PackageDialog, ParentLink } from "@/components/requests/request-package";
import { ActionButton, DueDateCell, SortableHead, DueWarning, FiltersBar, PaginationFooter, PersonLink, StatusBadge, formatDate, useRequestList } from "@/components/requests/request-list";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RequestsSummary, type SummaryStatus } from "@/components/requests/request-charts";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { todayIso, type MyRequest } from "@/lib/my-requests";
import { departments, findDepartment, findMember } from "@/lib/organization";
import { getReviewerPackage, listReviewerRequests } from "@/lib/requests.functions";

type ReviewerSearch = { departamento?: string; encargado?: string };

/** No sign-in yet: the reviewer comes from the URL, falling back to the first department and its head. */
function resolveReviewer(search: ReviewerSearch) {
  const department = findDepartment(search.departamento ?? "") ?? departments[0]!;
  const member = findMember(department.name, search.encargado ?? "") ?? department.members[0]!;
  return { department: department.name, assigneeName: member.name };
}

export const Route = createFileRoute("/revision-departamento")({
  validateSearch: (search: Record<string, unknown>): ReviewerSearch => {
    const { departamento, encargado } = search;
    return { ...(typeof departamento === "string" && { departamento }), ...(typeof encargado === "string" && { encargado }) };
  },
  loaderDeps: ({ search }) => resolveReviewer(search),
  loader: ({ deps }) => listReviewerRequests({ data: deps }),
  component: DepartmentReviewPage,
  head: () => ({ meta: [
    { title: "Revisión del departamento | Ecosistema X" },
    { name: "description", content: "Bandeja del encargado de departamento: autoriza o rechaza las solicitudes que le delegó el Administrador de Contrato." },
    { property: "og:title", content: "Revisión del departamento | Ecosistema X" },
    { property: "og:description", content: "Autoriza o rechaza solicitudes delegadas a tu departamento." },
  ] }),
});

const summary: SummaryStatus[] = [
  { status: "En revisión", label: "Por revisar" },
  { status: "Autorizado", label: "Autorizadas" },
  { status: "Rechazado", label: "Rechazadas" },
  { status: "Anulado", label: "Anuladas" },
];

function DepartmentReviewPage() {
  const today = useMemo(todayIso, []);
  const requests = Route.useLoaderData();
  const reviewer = resolveReviewer(Route.useSearch());
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const list = useRequestList(requests);
  // Keep the code, not a copy, so the open detail shows fresh data after every change.
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const reviewing = requests.find(request => request.code === reviewingCode) ?? null;
  const [chat, setChat] = useState<ChatTarget | null>(null);
  // A reviewer only lists their own requests, so the rest of a package comes from the server.
  const loadPackage = useServerFn(getReviewerPackage);
  const [packageCode, setPackageCode] = useState<string | null>(null);
  const [packageState, setPackageState] = useState<{ children: MyRequest[]; loading: boolean; error: string }>({ children: [], loading: false, error: "" });
  useEffect(() => {
    if (!packageCode) return;
    let active = true;
    setPackageState({ children: [], loading: true, error: "" });
    loadPackage({ data: { reviewer, parentCode: packageCode } })
      .then(response => { if (active) setPackageState({ children: response.requests ?? [], loading: false, error: response.error ?? "" }); })
      .catch(() => { if (active) setPackageState({ children: [], loading: false, error: "No se pudo cargar el paquete." }); });
    return () => { active = false; };
  }, [packageCode, requests]);
  const members = findDepartment(reviewer.department)?.members ?? [];
  const actAs = (department: string, assigneeName?: string) => navigate({ search: { departamento: department, encargado: assigneeName ?? findDepartment(department)!.members[0]!.name } });

  return (
    <AppShell trail={["Solicitudes", "Revisión del departamento"]}>
      <TooltipProvider delayDuration={200}>
        <div className="my-requests">
          <p className="eyebrow">ENCARGADO DE DEPARTAMENTO · {reviewer.department.toUpperCase()}</p>
          <h1 className="page-heading">Revisión del departamento</h1>
          <p className="page-description">Solicitudes que el Administrador de Contrato delegó para tu revisión. Autorízalas o recházalas.</p>

          <section className="reviewer-picker" aria-label="Encargado que revisa">
            <div className="requirement-field">
              <label id="reviewer-department-label">Departamento</label>
              <Select value={reviewer.department} onValueChange={value => actAs(value)}>
                <SelectTrigger aria-labelledby="reviewer-department-label" className="requirement-control"><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="requirement-field">
              <label id="reviewer-member-label">Actuar como</label>
              <Select value={reviewer.assigneeName} onValueChange={value => actAs(reviewer.department, value)}>
                <SelectTrigger aria-labelledby="reviewer-member-label" className="requirement-control"><SelectValue /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.name} value={m.name}>{m.name} · {m.role}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="reviewer-picker-note">Vista previa sin inicio de sesión: elige qué encargado está revisando.</p>
          </section>

          <FiltersBar list={list} />

          <div className="requests-layout">
            <section className="requests-table-card" aria-label="Solicitudes delegadas">
              <Table className="requests-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <SortableHead list={list} column="createdAt" />
                    <SortableHead list={list} column="dueDate" />
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="actions-head">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.pageData.items.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="requests-empty">{requests.length ? "No hay solicitudes que coincidan con la búsqueda o los filtros." : `No hay solicitudes delegadas a ${reviewer.assigneeName}.`}</TableCell></TableRow>
                  )}
                  {list.pageData.items.map(request => (
                    <TableRow key={request.code}>
                      <TableCell><span className="code-cell"><span className="request-code">{request.code}</span><ParentLink request={request} onOpen={setPackageCode} /></span></TableCell>
                      <TableCell><span className="category-cell">{request.category}{request.element && <span className="element-cell">{request.element}</span>}</span></TableCell>
                      <TableCell className="request-date">{formatDate(request.createdAt)}</TableCell>
                      <TableCell className="request-date"><DueDateCell request={request} /></TableCell>
                      <TableCell><div className="status-line"><StatusBadge status={request.status} /><DueWarning request={request} today={today} /></div></TableCell>
                      <TableCell className="authorizer">Por <PersonLink person={request.requester} onOpen={() => setChat({ person: request.requester, requestCode: request.code, relation: `Solicitante de ${request.code}` })} /></TableCell>
                      <TableCell>
                        <div className="row-actions">
                          <ActionButton label={`Revisar ${request.code}`} onClick={() => setReviewingCode(request.code)}><SquareArrowOutUpRight /></ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationFooter list={list} />
            </section>
            <RequestsSummary list={list} statuses={summary} today={today} note="Solo puedes decidir las solicitudes en revisión que te delegaron. Si una no corresponde a tu departamento, habla con el Administrador de Contrato." />
          </div>
        </div>

        <PackageDialog parentCode={packageCode} children={packageState.children} loading={packageState.loading} error={packageState.error} today={today} onClose={() => setPackageCode(null)}
          canOpenChild={child => requests.some(own => own.code === child.code)} onOpenChild={child => { setPackageCode(null); setReviewingCode(child.code); }} />
        <AdminRequestDetail request={reviewing} today={today} reviewer={reviewer} onClose={() => setReviewingCode(null)} onChanged={() => router.invalidate()}
          onOpenPackage={code => { setReviewingCode(null); setPackageCode(code); }}
          onChat={(person, relation) => { setChat({ person, requestCode: reviewing?.code ?? "", relation }); setReviewingCode(null); }} />
        <InternalChat target={chat} onOpenChange={open => { if (!open) setChat(null); }} />
      </TooltipProvider>
    </AppShell>
  );
}
