import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { RequestStatus } from "@/lib/my-requests";
import type { RequestList } from "@/components/requests/request-list";
import { ChartSkeleton } from "@/components/requests/request-skeletons";

/** A status the page summarizes, with the short name its chart row shows. */
export type SummaryStatus = { status: RequestStatus; label: string };

type Row = { key: string; label: string; count: number; color: string };

const ROW_HEIGHT = 40;
// Same colors as the status badges in the table, so a state reads the same everywhere.
export const statusColors: Record<RequestStatus, string> = {
  "Enviada": "var(--status-sent)",
  "En revisión": "var(--status-review)",
  "En gestión": "var(--status-managing)",
  "Completada": "var(--status-completed)",
  "Rechazado": "var(--status-rejected)",
  "Anulado": "var(--status-cancelled)",
};
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
 * without a legend. Each bar wears the color of what it counts; the label beside it names it.
 */
function HorizontalBars({ rows, title }: { rows: Row[]; title: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  // The chart measures its container before drawing (and cannot on the server): hold its place until then.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ChartSkeleton rows={rows.length} />;
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
          >
            {rows.map(row => <Cell key={row.key} fill={row.color} />)}
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

/** Requests by status in the dashboard's period. */
export function StatusChart({ list, statuses }: { list: RequestList; statuses: SummaryStatus[] }) {
  const rows = statuses.map(({ status, label }): Row => ({
    key: status,
    label,
    count: list.statusScope.filter(request => request.status === status).length,
    color: statusColors[status],
  }));
  return (
    <>
      <HorizontalBars rows={rows} title="Solicitudes por estado" />
    </>
  );
}
