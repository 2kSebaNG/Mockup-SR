import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Ban, CheckCircle2, ClipboardCheck, SquareArrowOutUpRight, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InternalChat, type ChatTarget } from "@/components/internal-chat";
import { AdminRequestDetail } from "@/components/requests/admin-request-dialogs";
import { ActionButton, DueDateHead, DueWarning, FiltersAside, PaginationFooter, PersonLink, StatusBadge, SummaryCards, formatDate, useRequestList, type SummaryCard } from "@/components/requests/request-list";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { countByStatus, todayIso, type MyRequest } from "@/lib/my-requests";
import { departments, findDepartment, findMember } from "@/lib/organization";
import { listReviewerRequests } from "@/lib/requests.functions";

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

const cards: SummaryCard[] = [
  { status: "En revisión", label: "Solicitudes por revisar", icon: <ClipboardCheck /> },
  { status: "Autorizado", label: "Solicitudes autorizadas", icon: <CheckCircle2 /> },
  { status: "Rechazado", label: "Solicitudes rechazadas", icon: <XCircle /> },
  { status: "Anulado", label: "Anuladas por el solicitante", icon: <Ban /> },
];

function DepartmentReviewPage() {
  const today = useMemo(todayIso, []);
  const requests = Route.useLoaderData();
  const reviewer = resolveReviewer(Route.useSearch());
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const list = useRequestList(requests);
  const counts = useMemo(() => countByStatus(requests), [requests]);
  const [reviewing, setReviewing] = useState<MyRequest | null>(null);
  const [chat, setChat] = useState<ChatTarget | null>(null);
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

          <SummaryCards cards={cards} counts={counts} />

          <div className="requests-layout">
            <section className="requests-table-card" aria-label="Solicitudes delegadas">
              <Table className="requests-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <DueDateHead list={list} />
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="actions-head">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.pageData.items.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="requests-empty">{requests.length ? "No hay solicitudes que coincidan con la búsqueda o los filtros." : `No hay solicitudes delegadas a ${reviewer.assigneeName}.`}</TableCell></TableRow>
                  )}
                  {list.pageData.items.map(request => (
                    <TableRow key={request.code}>
                      <TableCell className="request-code">{request.code}</TableCell>
                      <TableCell>{request.category}</TableCell>
                      <TableCell className="request-date">{formatDate(request.dueDate)}</TableCell>
                      <TableCell><div className="status-line"><StatusBadge status={request.status} /><DueWarning request={request} today={today} /></div></TableCell>
                      <TableCell className="authorizer">Por <PersonLink person={request.requester} onOpen={() => setChat({ person: request.requester, requestCode: request.code, relation: `Solicitante de ${request.code}` })} /></TableCell>
                      <TableCell>
                        <div className="row-actions">
                          <ActionButton label={`Revisar ${request.code}`} onClick={() => setReviewing(request)}><SquareArrowOutUpRight /></ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationFooter list={list} />
            </section>
            <FiltersAside list={list} note="Solo puedes decidir las solicitudes en revisión que te delegaron. Si una no corresponde a tu departamento, habla con el Administrador de Contrato." />
          </div>
        </div>

        <AdminRequestDetail request={reviewing} today={today} reviewer={reviewer} onClose={() => setReviewing(null)} onChanged={() => router.invalidate()}
          onChat={(person, relation) => { setChat({ person, requestCode: reviewing?.code ?? "", relation }); setReviewing(null); }} />
        <InternalChat target={chat} onOpenChange={open => { if (!open) setChat(null); }} />
      </TooltipProvider>
    </AppShell>
  );
}
