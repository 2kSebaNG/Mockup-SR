import { useMemo } from "react";
import { Info } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { DUE_SOON_DAYS, dueState, type MyRequest, type RequestStatus } from "@/lib/my-requests";
import type { RequestList } from "@/components/requests/request-list";

/** A status the page summarizes, with the short name its chart row shows. */
export type SummaryStatus = { status: RequestStatus; label: string };

type Row = { key: string; label: string; count: number; emphasis: "none" | "accent" | "alert" };

const ROW_HEIGHT = 40;
const fills: Record<Row["emphasis"], string> = { none: "var(--chart-neutral)", accent: "var(--chart-accent)", alert: "var(--chart-alert)" };
const config = { count: { label: "Solicitudes" } } satisfies ChartConfig;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function RowTooltip({ active, payload, total }: { active?: boolean; payload?: { payload: Row }[]; total: number }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const share = total ? Math.round((row.count / total) * 100) : 0;
  return (
    <div className="chart-tooltip">
      <strong>{row.label}</strong>
      <span>{plural(row.count, "solicitud", "solicitudes")} · {share}% del total</span>
    </div>
  );
}

/**
 * One horizontal bar per row with its value written at the end: readable at a glance on a phone
 * without a legend. Emphasis colors only what needs attention; everything else stays neutral.
 */
function HorizontalBars({ rows, title, onSelect }: { rows: Row[]; title: string; onSelect?: (row: Row) => void }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <>
      <ChartContainer config={config} className="request-chart" style={{ height: rows.length * ROW_HEIGHT }} aria-hidden="true">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" dataKey="count" hide domain={[0, (max: number) => Math.max(max, 1)]} />
          <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
          <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<RowTooltip total={total} />} />
          <Bar
            dataKey="count"
            radius={4}
            // Values must stay on screen: an animated redraw would hide them for a moment after each filter change.
            isAnimationActive={false}
            minPointSize={2}
            background={{ fill: "var(--muted)", radius: 4 }}
            {...(onSelect && { className: "chart-bar-selectable", onClick: (data: { payload?: Row }) => data.payload && onSelect(data.payload) })}
          >
            {rows.map(row => <Cell key={row.key} fill={fills[row.emphasis]} />)}
            <LabelList dataKey="count" position="right" className="chart-value" />
          </Bar>
        </BarChart>
      </ChartContainer>
      {/* The bars are drawn for sight; this list carries the same numbers for screen readers. */}
      <ul className="sr-only" aria-label={title}>
        {rows.map(row => <li key={row.key}>{row.label}: {row.count}</li>)}
      </ul>
    </>
  );
}

/** Requests by status. Ignores the status filter so every bar stays visible; clicking a bar toggles that filter. */
function StatusChart({ list, statuses }: { list: RequestList; statuses: SummaryStatus[] }) {
  const selected = list.filters.statuses;
  const rows = statuses.map(({ status, label }): Row => ({
    key: status,
    label,
    count: list.statusScope.filter(request => request.status === status).length,
    emphasis: selected.includes(status) ? "accent" : "none",
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <figure className="chart-card">
      <figcaption className="chart-heading">
        <h2>Por estado</h2>
        <p><strong>{total}</strong> {total === 1 ? "solicitud" : "solicitudes"}</p>
      </figcaption>
      <HorizontalBars rows={rows} title="Solicitudes por estado" onSelect={row => list.toggleFilter("statuses", row.key, !selected.includes(row.key as RequestStatus))} />
      <p className="chart-hint">{selected.length ? "Las barras destacadas filtran la tabla. Tócalas de nuevo para quitarlas." : "Toca una barra para filtrar la tabla por ese estado."}</p>
    </figure>
  );
}

/** How the requests still waiting on a decision stand against their due date. */
function DeadlineChart({ requests, today }: { requests: MyRequest[]; today: string }) {
  const rows = useMemo(() => {
    const pending = requests.filter(request => request.status === "Enviada" || request.status === "En revisión");
    const states = pending.map(request => dueState(request, today));
    const overdue = states.filter(state => state === "overdue").length;
    const soon = states.filter(state => state === "soon").length;
    return [
      { key: "overdue", label: "Vencidas", count: overdue, emphasis: overdue ? "alert" : "none" },
      { key: "soon", label: "Por vencer", count: soon, emphasis: "none" },
      { key: "onTime", label: "A tiempo", count: pending.length - overdue - soon, emphasis: "none" },
    ] satisfies Row[];
  }, [requests, today]);
  const pending = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <figure className="chart-card">
      <figcaption className="chart-heading">
        <h2>Plazos de las pendientes</h2>
        <p><strong>{pending}</strong> {pending === 1 ? "pendiente" : "pendientes"}</p>
      </figcaption>
      {pending
        ? <>
          <HorizontalBars rows={rows} title="Solicitudes pendientes por plazo" />
          <p className="chart-hint">Por vencer: su fecha límite llega en {DUE_SOON_DAYS} días o menos.</p>
        </>
        : <p className="chart-empty">No hay solicitudes pendientes de decisión con los filtros actuales.</p>}
    </figure>
  );
}

export function RequestCharts({ list, statuses, today }: { list: RequestList; statuses: SummaryStatus[]; today: string }) {
  return (
    <>
      <StatusChart list={list} statuses={statuses} />
      <DeadlineChart requests={list.visible} today={today} />
    </>
  );
}

/** Side column next to the table: the charts, then the page's note. */
export function RequestsSummary({ list, statuses, today, note }: { list: RequestList; statuses: SummaryStatus[]; today: string; note: string }) {
  return (
    <aside className="requests-sidebar" aria-label="Resumen de solicitudes">
      <RequestCharts list={list} statuses={statuses} today={today} />
      <p className="requests-note"><Info aria-hidden="true" />{note}</p>
    </aside>
  );
}
