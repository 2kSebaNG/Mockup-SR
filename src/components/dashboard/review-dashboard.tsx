import { useMemo } from "react";
import { AreaCompare, DashboardCard, Donut, GroupedBars, StackedBars, type Series } from "@/components/dashboard/dashboard-ui";
import { categoryColor } from "@/components/dashboard/my-requests-dashboard";
import { statusColors } from "@/components/requests/request-charts";
import { rangeScope, type RequestList } from "@/components/requests/request-list";
import type { RequestStatus } from "@/lib/my-requests";
import { byCategory, derivationsByDepartment, describePeriod, periodOr, receivedVsClassified, weeklyDemandByDepartment } from "@/lib/request-metrics";

const UNCLASSIFIED = "Sin clasificar";
const stackStatuses: RequestStatus[] = ["Enviada", "En revisión", "En gestión", "Completada", "Rechazado", "Anulado"];
const stackLabels: Record<RequestStatus, string> = { "Enviada": "Enviadas", "En revisión": "En revisión", "En gestión": "En gestión", "Completada": "Completadas", "Rechazado": "Rechazadas", "Anulado": "Anuladas" };
const stack: Series[] = stackStatuses.map(status => ({ key: status, label: stackLabels[status], color: statusColors[status] }));
const flow: Series[] = [
  { key: "recibidas", label: "Recibidas", color: "var(--series-1)" },
  { key: "clasificadas", label: "Clasificadas", color: "var(--series-2)" },
];
const demand: Series[] = [
  { key: "derivadas", label: "Derivadas", color: "var(--series-1)" },
  { key: "rechazadas", label: "Rechazadas", color: "var(--status-rejected)" },
];

/** The contract administrator's view of every request, following the filters above. */
export function ReviewDashboard({ list, today }: { list: RequestList; today: string }) {
  const requests = list.visible;
  const derivations = useMemo(() => derivationsByDepartment(requests), [requests]);
  const hasRange = Boolean(list.filters.from || list.filters.to);
  const scope = rangeScope(list);
  // Charts over time read the range as their axis and count every event inside it.
  const period = periodOr(list.filters, today, 14);
  const daily = useMemo(() => receivedVsClassified(list.dateScope, period), [list.dateScope, period.from, period.to]);
  // Last 7 days by default; with a chosen period, the weekly average over it.
  const demandPeriod = hasRange ? period : periodOr({ from: "", to: "" }, today, 7);
  const weekly = useMemo(() => weeklyDemandByDepartment(list.dateScope, demandPeriod), [list.dateScope, demandPeriod.from, demandPeriod.to]);
  const categories = useMemo(() => byCategory(requests).map((slice, index) => ({ ...slice, color: categoryColor(slice.key, index) })), [requests]);
  const unclassified = derivations.unclassified.Enviada + derivations.unclassified["En revisión"];
  // "Sin clasificar" leads the chart: it is the administrator's own queue.
  const rows = [{ department: UNCLASSIFIED, ...derivations.unclassified }, ...derivations.departments];
  const totals = daily.reduce((sum, day) => ({ recibidas: sum.recibidas + day.recibidas, clasificadas: sum.clasificadas + day.clasificadas }), { recibidas: 0, clasificadas: 0 });

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <DashboardCard title="Derivaciones por departamento" subtitle={`${unclassified} sin clasificar · ${derivations.departments.length} departamentos con solicitudes${scope ? ` · ${scope}` : ""}`}>
          <StackedBars data={rows} categoryKey="department" series={stack} labelWidth={128} />
        </DashboardCard>
        <DashboardCard title="Por categoría" subtitle={scope ? `Solicitudes ${scope}` : "Desglose de las solicitudes recibidas"}>
          <Donut slices={categories} totalLabel="solicitudes" />
        </DashboardCard>
        <DashboardCard title="Recibidas vs. clasificadas" subtitle={`${describePeriod(period)}: ${totals.recibidas} recibidas, ${totals.clasificadas} clasificadas (delegadas o decididas)`}>
          <AreaCompare data={daily} xKey="bucket" series={flow} />
        </DashboardCard>
        <DashboardCard title="Demanda semanal por departamento" subtitle={hasRange ? `Promedio semanal de derivadas y rechazadas · ${describePeriod(period).split(" · ")[0]}` : "Derivadas y rechazadas en los últimos 7 días"}>
          {weekly.length ? <GroupedBars data={weekly} categoryKey="department" series={demand} labelWidth={128} /> : <p className="chart-empty">Ninguna solicitud se ha derivado a un departamento con los filtros actuales.</p>}
        </DashboardCard>
      </div>
    </div>
  );
}
