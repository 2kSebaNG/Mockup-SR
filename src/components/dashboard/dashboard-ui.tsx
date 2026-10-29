import { useEffect, useState, type ReactNode } from "react";
import { type LabelProps, Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Shared pieces of the request dashboards, on shadcn charts: one card per chart, a skeleton until the chart can
// measure itself, thin marks, recessive axes, a legend whenever there are two or more series.

/** A series: the data key it reads, its legend name and its color token. */
export type Series = { key: string; label: string; color: string };

const configOf = (series: Series[]): ChartConfig => Object.fromEntries(series.map(item => [item.key, { label: item.label }]));
const tooltip = <ChartTooltipContent className="chart-tooltip-content" />;
const axis = { tickLine: false, axisLine: false, tick: { fontSize: 12 } } as const;

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** A chart's card: title and a short reading of it, then the chart, drawn once it can measure its width. */
export function DashboardCard({ title, subtitle, children, height = 240, wide = false, chart = true }: { title: string; subtitle?: ReactNode; children: ReactNode; height?: number; wide?: boolean; chart?: boolean }) {
  const mounted = useMounted();
  return (
    <section className={`dashboard-card${wide ? " wide" : ""}`} aria-label={title}>
      <header className="dashboard-card-heading">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {chart && !mounted ? <Skeleton className="dashboard-chart-skeleton" style={{ height }} /> : <div className="dashboard-card-body" style={chart ? { minHeight: height } : undefined}>{children}</div>}
    </section>
  );
}

export type Kpi = { label: string; value: ReactNode; hint: string; icon: ReactNode; tone?: "neutral" | "alert" };

/** The headline numbers of a dashboard: value first, then what it counts. */
export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <section className="kpi-row" aria-label="Indicadores">
      {items.map(item => (
        <article key={item.label} className={`kpi-card${item.tone === "alert" ? " alert" : ""}`}>
          <span className="kpi-icon" aria-hidden="true">{item.icon}</span>
          <div>
            <strong>{item.value}</strong>
            <span className="kpi-label">{item.label}</span>
            <span className="kpi-hint">{item.hint}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

/** Only the last point carries its value, so the end of each line reads without the tooltip. */
function endLabel(last: number) {
  return function Label(props: LabelProps & { index?: number }) {
    if (props.index !== last || props.value === null || props.value === undefined) return null;
    const value = typeof props.value === "number" ? props.value.toLocaleString("es-CL") : props.value;
    return <text x={Number(props.x) + 8} y={Number(props.y) + 4} className="chart-end-label">{value}</text>;
  };
}

/** Two or more measures over time on one scale. */
export function LineCompare({ data, xKey, series, height = 240, unit }: { data: Record<string, unknown>[]; xKey: string; series: Series[]; height?: number; unit?: string }) {
  return (
    <ChartContainer config={configOf(series)} className="dashboard-chart" style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} allowDecimals={false} width={44} {...(unit && { unit })} />
        <ChartTooltip content={tooltip} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map(item => (
          <Line key={item.key} dataKey={item.key} name={item.key} type="monotone" stroke={item.color} strokeWidth={2} dot={{ r: 3, fill: item.color }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false}>
            <LabelList content={endLabel(data.length - 1)} />
          </Line>
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** Volumes over time; with two series they overlap lightly so both stay visible. */
export function AreaCompare({ data, xKey, series, height = 240 }: { data: Record<string, unknown>[]; xKey: string; series: Series[]; height?: number }) {
  return (
    <ChartContainer config={configOf(series)} className="dashboard-chart" style={{ height }}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} allowDecimals={false} width={44} />
        <ChartTooltip content={tooltip} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map(item => (
          <Area key={item.key} dataKey={item.key} name={item.key} type="monotone" stroke={item.color} strokeWidth={2} fill={item.color} fillOpacity={series.length > 1 ? 0.18 : 0.28} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/**
 * Bars stacked by series, one bar per category. Horizontal by default: long names (departments, people) read on a
 * phone without rotating them. The total is written at the end of each bar.
 */
export function StackedBars({ data, categoryKey, series, labelWidth = 120, rowHeight = 40 }: { data: Record<string, unknown>[]; categoryKey: string; series: Series[]; labelWidth?: number; rowHeight?: number }) {
  const rows = data.map(row => ({ ...row, total: series.reduce((sum, item) => sum + Number(row[item.key] ?? 0), 0) }));
  const last = series.length - 1;
  return (
    <ChartContainer config={configOf(series)} className="dashboard-chart" style={{ height: rows.length * rowHeight + 56 }}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey={categoryKey} width={labelWidth} {...axis} tick={{ fontSize: 13 }} />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={tooltip} />
        <ChartLegend content={<ChartLegendContent className="chart-legend-wrap" />} />
        {series.map((item, index) => (
          // A 2px surface gap between segments keeps neighbours apart; only the outer end is rounded.
          <Bar key={item.key} dataKey={item.key} name={item.key} stackId="total" fill={item.color} stroke="var(--card)" strokeWidth={1} radius={index === last ? [0, 4, 4, 0] : 0} isAnimationActive={false}>
            {index === last && <LabelList dataKey="total" position="right" className="chart-value" />}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** Side-by-side bars per category for measures that are compared, not added. */
export function GroupedBars({ data, categoryKey, series, labelWidth = 120 }: { data: Record<string, unknown>[]; categoryKey: string; series: Series[]; labelWidth?: number }) {
  return (
    <ChartContainer config={configOf(series)} className="dashboard-chart" style={{ height: data.length * (series.length * 18 + 18) + 56 }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={10} barGap={2}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey={categoryKey} width={labelWidth} {...axis} tick={{ fontSize: 13 }} />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={tooltip} />
        <ChartLegend content={<ChartLegendContent className="chart-legend-wrap" />} />
        {series.map(item => (
          <Bar key={item.key} dataKey={item.key} name={item.key} fill={item.color} radius={[0, 4, 4, 0]} minPointSize={2} isAnimationActive={false}>
            <LabelList dataKey={item.key} position="right" className="chart-value" />
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** One measure per category in a single color, the value on top of each bar. */
export function ColumnBars({ data, categoryKey, valueKey, label, color, format = value => String(value), height = 240 }: { data: Record<string, unknown>[]; categoryKey: string; valueKey: string; label: string; color: string; format?: (value: number) => string; height?: number }) {
  return (
    <ChartContainer config={{ [valueKey]: { label } }} className="dashboard-chart" style={{ height }}>
      <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
        <XAxis dataKey={categoryKey} {...axis} interval={0} tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.split(" ")[0]!} />
        <YAxis hide />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={tooltip} />
        <Bar dataKey={valueKey} name={valueKey} fill={color} radius={[4, 4, 0, 0]} minPointSize={2} isAnimationActive={false}>
          <LabelList dataKey={valueKey} position="top" className="chart-value" formatter={(value: number) => format(value)} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export type DonutSlice = { key: string; label: string; count: number; color: string };

/** Part of a whole: the total in the middle and a legend that names every slice with its count and share. */
export function Donut({ slices, totalLabel }: { slices: DonutSlice[]; totalLabel: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const config = Object.fromEntries(slices.map(slice => [slice.key, { label: slice.label }])) satisfies ChartConfig;
  if (!total) return <p className="chart-empty">No hay solicitudes con los filtros actuales.</p>;
  return (
    <div className="donut">
      <ChartContainer config={config} className="donut-chart">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent className="chart-tooltip-content" nameKey="key" hideLabel />} />
          <Pie data={slices} dataKey="count" nameKey="key" innerRadius="62%" outerRadius="96%" paddingAngle={1} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
            {slices.map(slice => <Cell key={slice.key} fill={slice.color} />)}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" className="donut-total">{total}</text>
          <text x="50%" y="60%" textAnchor="middle" className="donut-total-label">{totalLabel}</text>
        </PieChart>
      </ChartContainer>
      <ul className="donut-legend">
        {slices.map(slice => (
          <li key={slice.key}>
            <span className="legend-swatch" style={{ background: slice.color }} aria-hidden="true" />
            <span className="donut-legend-label">{slice.label}</span>
            <strong>{slice.count}</strong>
            <span className="donut-legend-share">{Math.round((slice.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string };

/** A short data table; on phones each row becomes a card with its labels, since the columns would not fit. */
export function DataTable<T>({ rows, columns, rowKey }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string }) {
  return (
    <>
      <div className="dashboard-table">
        <Table>
          <TableHeader><TableRow>{columns.map(column => <TableHead key={column.header}>{column.header}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map(row => <TableRow key={rowKey(row)}>{columns.map(column => <TableCell key={column.header} {...(column.className && { className: column.className })}>{column.cell(row)}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </div>
      <ul className="dashboard-cards">
        {rows.map(row => (
          <li key={rowKey(row)}>
            {columns.map(column => <div key={column.header}><span>{column.header}</span><div>{column.cell(row)}</div></div>)}
          </li>
        ))}
      </ul>
    </>
  );
}

/** A banner that says the numbers below are illustrative. */
export function SampleDataNotice({ children }: { children: ReactNode }) {
  return <p className="sample-notice" role="note">{children}</p>;
}
