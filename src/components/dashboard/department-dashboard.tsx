import { useMemo } from "react";
import { CalendarX2, Layers, Repeat2, UserX } from "lucide-react";
import { AreaCompare, ColumnBars, DashboardCard, DataTable, KpiRow, LineCompare, SampleDataNotice, StackedBars, type Series } from "@/components/dashboard/dashboard-ui";
import { deadlineText } from "@/components/dashboard/my-requests-dashboard";
import { formatDate } from "@/components/requests/request-list";
import { describePeriod, periodOr } from "@/lib/request-metrics";
import { averageDaysByType, completedOverTime, estimateVsActual, sampleStages, skipRateByType, stageKpis, stageTypes, stagesNeedingOwner, workloadByExecutor } from "@/lib/department-stages.sample";

const workload: Series[] = stageTypes.map((type, index) => ({ key: type, label: type, color: `var(--series-${index + 1})` }));
const throughput: Series[] = [{ key: "completadas", label: "Etapas completadas", color: "var(--status-completed)" }];
const compliance: Series[] = [
  { key: "estimado", label: "Estimado", color: "var(--series-1)" },
  { key: "real", label: "Real", color: "var(--series-2)" },
];

/** The department's stages: who carries what, how long each kind takes and what still needs an owner. */
export function DepartmentDashboard({ department, today, range }: { department: string; today: string; range: { from: string; to: string } }) {
  // The period defines the window of the charts over time; without one, the last 8 weeks.
  const period = periodOr(range, today, 56);
  const stages = useMemo(() => sampleStages(department, today), [department, today]);
  const kpis = stageKpis(stages, today);
  const people = workloadByExecutor(stages);
  const needingOwner = stagesNeedingOwner(stages);

  return (
    <div className="dashboard">
      <SampleDataNotice>
        <strong>Datos de ejemplo.</strong> Las solicitudes todavía no tienen etapas, así que este dashboard muestra un set de etapas generado para {department}. Los filtros de estado y categoría no lo cambian; el período sí define la ventana de los gráficos de tiempo.
      </SampleDataNotice>
      <KpiRow items={[
        { label: "Etapas activas", value: kpis.active, count: kpis.active, hint: "En curso en el departamento", icon: <Layers />, tone: "managing", share: { of: stages.length, label: "de todas las etapas" } },
        { label: "Etapas sin asignar", value: kpis.unassigned, count: kpis.unassigned, hint: "Activas sin ejecutor", icon: <UserX />, tone: "review", share: { of: kpis.active, label: "de las activas" } },
        { label: "Reasignaciones pendientes", value: kpis.reassignments, count: kpis.reassignments, hint: "Esperan pasar a otra persona", icon: <Repeat2 />, tone: "sent", share: { of: kpis.active, label: "de las activas" } },
        { label: "Etapas atrasadas", value: kpis.overdue, count: kpis.overdue, hint: "Activas con el plazo vencido", icon: <CalendarX2 />, tone: "rejected", share: { of: kpis.active, label: "de las activas" } },
      ]} />
      <div className="dashboard-grid">
        <DashboardCard title="Carga de trabajo por persona" subtitle="Etapas activas de cada ejecutor, por tipo de etapa">
          <StackedBars data={people} categoryKey="executor" series={workload} labelWidth={128} />
        </DashboardCard>
        <DashboardCard title="Rendimiento" subtitle={`Etapas completadas · ${describePeriod(period)}`}>
          <AreaCompare data={completedOverTime(stages, period)} xKey="bucket" series={throughput} />
        </DashboardCard>
        <DashboardCard title="Tiempo promedio por tipo de etapa" subtitle="Días desde que empieza hasta que se completa">
          <ColumnBars data={averageDaysByType(stages)} categoryKey="type" valueKey="dias" label="Días promedio" color="var(--series-1)" format={value => `${value.toLocaleString("es-CL")} d`} />
        </DashboardCard>
        <DashboardCard title="Tasa de omisión por etapa" subtitle="Porcentaje de etapas de cada tipo que se omitieron">
          <ColumnBars data={skipRateByType(stages)} categoryKey="type" valueKey="tasa" label="Omitidas (%)" color="var(--series-2)" format={value => `${value}%`} />
        </DashboardCard>
        <DashboardCard title="Estimado vs. real" subtitle={`Días promedio de las etapas completadas (${describePeriod(period)}): sobre la línea estimada es atraso`} wide>
          <LineCompare data={estimateVsActual(stages, period)} xKey="bucket" series={compliance} unit=" d" />
        </DashboardCard>
        <DashboardCard title="Etapas sin responsable o por reasignar" subtitle={`${needingOwner.length} etapas, las más urgentes primero`} chart={false} wide>
          {needingOwner.length ? (
            <DataTable rows={needingOwner} rowKey={stage => stage.id} columns={[
              { header: "Solicitud", cell: stage => stage.requestCode, className: "request-code" },
              { header: "Etapa", cell: stage => stage.type },
              { header: "Situación", cell: stage => stage.executor === null ? <span className="unassigned">Sin responsable</span> : <>Reasignar desde <strong>{stage.reassignFrom}</strong></> },
              { header: "Inició", cell: stage => formatDate(stage.startedAt), className: "request-date" },
              { header: "Plazo", cell: stage => <span className="date-cell">{formatDate(stage.dueAt)}<span className={`estimate-cell${stage.dueAt < today ? " overdue-text" : ""}`}>{deadlineText(today, stage.dueAt)}</span></span> },
            ]} />
          ) : <p className="chart-empty">Todas las etapas activas tienen responsable.</p>}
        </DashboardCard>
      </div>
    </div>
  );
}
