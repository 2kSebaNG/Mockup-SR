import { useMemo } from "react";
import { CheckCircle2, Clock3, Hourglass, TriangleAlert } from "lucide-react";
import { DashboardCard, DataTable, Donut, KpiRow, LineCompare, type Series } from "@/components/dashboard/dashboard-ui";
import { StatusChart, type SummaryStatus } from "@/components/requests/request-charts";
import { StatusBadge, formatDate, type RequestList } from "@/components/requests/request-list";
import { daysBetween } from "@/lib/my-requests";
import { byCategory, createdVsCompleted, dueSoon, requesterKpis } from "@/lib/request-metrics";

const statuses: SummaryStatus[] = [
  { status: "Enviada", label: "Enviadas" },
  { status: "En revisión", label: "En revisión" },
  { status: "En gestión", label: "En gestión" },
  { status: "Completada", label: "Completadas" },
  { status: "Rechazado", label: "Rechazadas" },
];
const trend: Series[] = [
  { key: "creadas", label: "Creadas", color: "var(--status-sent)" },
  { key: "completadas", label: "Completadas", color: "var(--status-completed)" },
];
/** Categories take the categorical palette in fixed order; whatever folds into "Otras" stays gray. */
export const categoryColor = (key: string, index: number) => (key === "otras" ? "var(--muted-foreground)" : `var(--series-${index + 1})`);

export function deadlineText(today: string, dueDate: string) {
  const left = daysBetween(today, dueDate);
  if (left < 0) return `Vencida hace ${-left} ${-left === 1 ? "día" : "días"}`;
  return left === 0 ? "Vence hoy" : `En ${left} ${left === 1 ? "día" : "días"}`;
}

/** The requester's view of their own requests, following the filters above. */
export function MyRequestsDashboard({ list, today }: { list: RequestList; today: string }) {
  const requests = list.visible;
  const kpis = useMemo(() => requesterKpis(requests, today), [requests, today]);
  const weekly = useMemo(() => createdVsCompleted(requests, today), [requests, today]);
  const categories = useMemo(() => byCategory(requests).map((slice, index) => ({ ...slice, color: categoryColor(slice.key, index) })), [requests]);
  const soon = useMemo(() => dueSoon(requests, today), [requests, today]);
  const weekTotals = weekly.reduce((sum, week) => ({ creadas: sum.creadas + week.creadas, completadas: sum.completadas + week.completadas }), { creadas: 0, completadas: 0 });

  return (
    <div className="dashboard">
      <KpiRow items={[
        { label: "Activas", value: kpis.active, hint: "Enviadas, en revisión o en gestión", icon: <Hourglass /> },
        { label: "Completadas", value: kpis.completed, hint: "Resueltas a favor", icon: <CheckCircle2 /> },
        { label: "Atrasadas", value: kpis.overdue, hint: "Activas con la fecha límite vencida", icon: <TriangleAlert />, tone: kpis.overdue ? "alert" : "neutral" },
        { label: "Tiempo promedio de resolución", value: kpis.averageResolutionDays === null ? "—" : <>{kpis.averageResolutionDays.toLocaleString("es-CL")}<small> días</small></>, hint: "Desde que se crea hasta que se completa o rechaza", icon: <Clock3 /> },
      ]} />
      <div className="dashboard-grid">
        <DashboardCard title="Solicitudes por estado" subtitle={`${list.statusScope.filter(request => statuses.some(item => item.status === request.status)).length} solicitudes`} height={statuses.length * 40}>
          <StatusChart list={list} statuses={statuses} />
        </DashboardCard>
        <DashboardCard title="Creadas vs. completadas" subtitle={`Últimas 8 semanas: ${weekTotals.creadas} creadas, ${weekTotals.completadas} completadas`}>
          <LineCompare data={weekly} xKey="week" series={trend} />
        </DashboardCard>
        <DashboardCard title="Por categoría" subtitle="Qué pides con más frecuencia" height={220}>
          <Donut slices={categories} totalLabel="solicitudes" />
        </DashboardCard>
        <DashboardCard title="Próximas a vencer" subtitle="Activas que vencen en 7 días o menos, y las ya vencidas" chart={false}>
          {soon.length ? (
            <DataTable rows={soon} rowKey={request => request.code} columns={[
              { header: "Código", cell: request => request.code, className: "request-code" },
              { header: "Ítem solicitado", cell: request => <span className="date-cell">{request.element || request.category}<span className="estimate-cell">{request.category}</span></span> },
              { header: "Departamento", cell: request => request.department ?? <span className="unassigned">Sin delegar</span> },
              { header: "Plazo", cell: request => <span className="date-cell">{formatDate(request.dueDate)}<span className={`estimate-cell${request.dueDate < today ? " overdue-text" : ""}`}>{deadlineText(today, request.dueDate)}</span></span> },
              { header: "Estado", cell: request => <StatusBadge status={request.status} /> },
            ]} />
          ) : <p className="chart-empty">No tienes solicitudes activas por vencer con los filtros actuales.</p>}
        </DashboardCard>
      </div>
    </div>
  );
}
