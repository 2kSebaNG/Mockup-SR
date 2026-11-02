import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { DataListSkeleton, EmptyState, FilterBar, FilterField, Panel, Stack, Stat, StatRow } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDisplayAmount } from "@/lib/abastecimiento/format";
import { useVendorMetrics } from "@/lib/abastecimiento/hooks";
import { SORT_LABELS, dearestAndCheapest, formatPriceDeviation, formatSeniority, priceDeviation, priceTone, sortMetrics, thisYear, topBy, type MetricSort, type VendorMetric } from "@/lib/abastecimiento/vendor-metrics";
import { LoadError } from "./admin-ui";

const TOP = 10;

type RankItem = { key: string; label: string; value: number; text: string; note?: string };

/** The vendors ranked by one measure, as bars against the highest. */
function RankBars({ label, items }: { label: string; items: RankItem[] }) {
  const max = Math.max(1, ...items.map(item => item.value));
  if (items.length === 0) return <p className="ds-meta">Nadie tiene esto en el período.</p>;
  return (
    <ol className="ab-rank" aria-label={label}>
      {items.map(item => (
        <li key={item.key}>
          <span className="ab-rank-label" title={item.label}>{item.label}</span>
          <span className="ab-rank-track">
            <span className="ab-rank-bar" style={{ width: `${(item.value / max) * 75}%` }} />
            <span className="ab-rank-value">{item.text}{item.note && <span className="ab-rank-note">{item.note}</span>}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Above or below the average price, from the middle line: dearer to the right (red), cheaper to the left (green). */
function DivergingBars({ label, items }: { label: string; items: { key: string; label: string; deviation: number; text: string; note: string }[] }) {
  const max = Math.max(0.01, ...items.map(item => Math.abs(item.deviation)));
  return (
    <ol className="ab-rank" aria-label={label}>
      {items.map(item => {
        const width = `${(Math.abs(item.deviation) / max) * 100}%`;
        return (
          <li key={item.key}>
            <span className="ab-rank-label" title={item.label}>{item.label}</span>
            <span>
              <span className="ab-diverge" aria-hidden="true">
                {item.deviation < 0 ? <span className="ab-diverge-under" style={{ width }} /> : <span />}
                <span className="ab-diverge-axis">{item.deviation > 0 && <span className="ab-diverge-over block h-[14px]" style={{ width }} />}</span>
              </span>
              <span className={item.deviation > 0 ? "ab-bad" : "ab-good"}>{item.text}</span> <span className="ds-meta">· {item.note}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const columns: { sort: MetricSort; end: boolean }[] = [
  { sort: "name", end: false }, { sort: "paid", end: true }, { sort: "orders", end: true }, { sort: "average", end: true }, { sort: "seniority", end: true }, { sort: "price", end: true },
];

/** Every vendor with all its figures, ordered by any column. */
function MetricsTable({ metrics }: { metrics: VendorMetric[] }) {
  const [sort, setSort] = useState<MetricSort>("paid");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const rows = useMemo(() => sortMetrics(metrics, sort, direction), [metrics, sort, direction]);
  const choose = (next: MetricSort) => {
    if (next === sort) setDirection(current => (current === "asc" ? "desc" : "asc"));
    else { setSort(next); setDirection(next === "name" ? "asc" : "desc"); }
  };
  return (
    <section className="ds-panel ds-panel--flush overflow-x-auto" aria-label="Métricas por proveedor">
      <Table className="ds-table min-w-[760px]">
        <TableHeader>
          <TableRow>
            {columns.map(column => {
              const Icon = sort !== column.sort ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
              return (
                <TableHead key={column.sort} className={column.end ? "ds-align-end" : undefined} aria-sort={sort === column.sort ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="ab-sort" onClick={() => choose(column.sort)}>{SORT_LABELS[column.sort]}<Icon aria-hidden="true" /></button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(metric => {
            const tone = priceTone(metric.priceIndex);
            return (
              <TableRow key={metric.id}>
                <TableCell>
                  <strong className="block">{metric.name}</strong>
                  {metric.categories.length > 0 && <span className="ds-meta">{metric.categories.join(" · ")}</span>}
                </TableCell>
                <TableCell className="ds-align-end">{formatDisplayAmount(metric.paidAmount)}</TableCell>
                <TableCell className="ds-align-end">{metric.ordersCount}</TableCell>
                <TableCell className="ds-align-end">{metric.ordersCount > 0 ? formatDisplayAmount(metric.averageOrderAmount) : "—"}</TableCell>
                <TableCell className="ds-align-end">{formatSeniority(metric.seniorityMonths)}<span className="ds-meta block">desde {formatDate(metric.since)}</span></TableCell>
                <TableCell className={`ds-align-end ${tone === "bad" ? "ab-bad" : tone === "good" ? "ab-good" : ""}`} title={metric.comparedItems > 0 ? `Comparado en ${metric.comparedItems} ${metric.comparedItems === 1 ? "ítem" : "ítems"}` : undefined}>
                  {formatPriceDeviation(metric.priceIndex)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}

function Chart({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <Panel title={title} description={subtitle}>{children}</Panel>;
}

/**
 * The vendors' figures (source: VendorMetricsPanel): who was paid the most, who has the most orders and for how long,
 * who charges more or less for the same items. The vendors are those of the screen's filters (categories, inactive);
 * the period of the orders is chosen here. Until phase 2 brings the purchase orders, the orders are a sample.
 */
export function VendorMetricsPanel({ categoryIds, categoryLabel, includeInactive }: { categoryIds: string[]; categoryLabel: string; includeInactive: boolean }) {
  const [period, setPeriod] = useState({ from: "", to: "" });
  const { data, isLoading, error } = useVendorMetrics({
    ...(categoryIds.length > 0 && { categoryIds }), ...(includeInactive && { includeInactive }), ...(period.from && { from: period.from }), ...(period.to && { to: period.to }),
  });
  const model = useMemo(() => {
    if (!data) return null;
    const { dearest, cheapest } = dearestAndCheapest(data.vendors, 5);
    return {
      paid: topBy(data.vendors, "paid", TOP), orders: topBy(data.vendors, "orders", TOP), average: topBy(data.vendors, "average", TOP),
      seniority: topBy(data.vendors, "seniority", TOP), price: [...dearest, ...[...cheapest].reverse()],
    };
  }, [data]);
  const scope = [
    categoryLabel ? `Categorías: ${categoryLabel}` : "Todas las categorías",
    period.from || period.to ? `OC del ${period.from ? formatDate(period.from) : "inicio"} al ${period.to ? formatDate(period.to) : "hoy"}` : "Todas las OC",
  ].join(" · ");

  return (
    <Stack>
      <FilterBar label="Período de las órdenes" end={<>
        <Button variant="outline" onClick={() => setPeriod(thisYear())}>Este año</Button>
        <Button variant="outline" onClick={() => setPeriod({ from: "", to: "" })}>Todo</Button>
      </>}>
        <FilterField id="metrics-from" label="Desde">
          <Input id="metrics-from" type="date" value={period.from} max={period.to || undefined} onChange={event => setPeriod(current => ({ ...current, from: event.target.value }))} />
        </FilterField>
        <FilterField id="metrics-to" label="Hasta">
          <Input id="metrics-to" type="date" value={period.to} min={period.from || undefined} onChange={event => setPeriod(current => ({ ...current, to: event.target.value }))} />
        </FilterField>
      </FilterBar>
      <p className="ds-meta">{scope}</p>
      {isLoading && <DataListSkeleton label="Métricas" columns={6} />}
      {error && <LoadError what="las métricas" />}
      {data && model && (
        <>
          <StatRow>
            <Stat label="Desembolsado" value={formatDisplayAmount(data.totals.paidAmount)} hint={`de ${formatDisplayAmount(data.totals.orderedAmount)} ordenado`} />
            <Stat label="OC realizadas" value={data.totals.ordersCount} hint="aprobadas o pagadas" />
            <Stat label="Monto por OC" value={formatDisplayAmount(data.totals.averageOrderAmount)} hint="promedio, neto" />
            <Stat label="Proveedores" value={data.totals.vendors} hint={`${data.totals.vendorsWithOrders} con OC en el período`} />
          </StatRow>
          {data.totals.ordersCount === 0 ? (
            <EmptyState title="Sin órdenes en este período" inline>No hay órdenes de compra aprobadas o pagadas de estos proveedores en el período elegido.</EmptyState>
          ) : (
            <div className="ab-charts">
              <Chart title="Dinero desembolsado" subtitle="OC pagadas, neto, por proveedor">
                <RankBars label="Proveedores por dinero desembolsado" items={model.paid.map(metric => ({ key: metric.id, label: metric.name, value: metric.paidAmount, text: formatDisplayAmount(metric.paidAmount) }))} />
              </Chart>
              <Chart title="OC realizadas" subtitle="Aprobadas o pagadas, por proveedor">
                <RankBars label="Proveedores por cantidad de OC" items={model.orders.map(metric => ({ key: metric.id, label: metric.name, value: metric.ordersCount, text: `${metric.ordersCount} OC`, note: `${formatDisplayAmount(metric.orderedAmount)} ordenado` }))} />
              </Chart>
              <Chart title="Quién cobra más y quién menos" subtitle="Precio de los mismos ítems frente al promedio de quienes los vendieron">
                {model.price.length === 0
                  ? <p className="ds-meta">Todavía no hay ítems que dos proveedores distintos hayan vendido: sin eso no se pueden comparar precios.</p>
                  : <DivergingBars label="Proveedores por precio frente al promedio" items={model.price.map(metric => ({ key: metric.id, label: metric.name, deviation: priceDeviation(metric.priceIndex ?? 1), text: formatPriceDeviation(metric.priceIndex), note: `${metric.comparedItems} ${metric.comparedItems === 1 ? "ítem" : "ítems"}` }))} />}
              </Chart>
              <Chart title="Monto promedio por OC" subtitle="Neto, por proveedor">
                <RankBars label="Proveedores por monto promedio" items={model.average.map(metric => ({ key: metric.id, label: metric.name, value: metric.averageOrderAmount, text: formatDisplayAmount(metric.averageOrderAmount) }))} />
              </Chart>
              <Chart title="Antigüedad" subtitle="Desde su primera OC, o desde que se registró si es antes">
                <RankBars label="Proveedores por antigüedad" items={model.seniority.map(metric => ({ key: metric.id, label: metric.name, value: metric.seniorityMonths, text: formatSeniority(metric.seniorityMonths), note: `Desde ${formatDate(metric.since)}` }))} />
              </Chart>
            </div>
          )}
          <MetricsTable metrics={data.vendors} />
        </>
      )}
    </Stack>
  );
}
