import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholders shaped like what replaces them, so nothing jumps when the data arrives.
const barWidths = ["82%", "46%", "68%", "28%", "56%"];

/** Bars of a summary chart while it measures its width and draws. */
export function ChartSkeleton({ rows }: { rows: number }) {
  return (
    <div className="chart-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="chart-skeleton-row">
          <Skeleton className="chart-skeleton-label" />
          <Skeleton className="chart-skeleton-bar" style={{ width: barWidths[index % barWidths.length] }} />
        </div>
      ))}
    </div>
  );
}

function ChartCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="chart-card">
      <div className="chart-heading"><Skeleton className="skeleton-heading" /><Skeleton className="skeleton-number" /></div>
      <ChartSkeleton rows={rows} />
    </div>
  );
}

function TableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div className="requests-table-card table-skeleton">
      <div className="table-skeleton-row head" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="skeleton-line short" />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="table-skeleton-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={`skeleton-line${column % 3 === 1 ? " short" : ""}`} />)}
        </div>
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="filters-bar">
      {["filter-search", "", "", "filter-dates"].map((className, index) => (
        <div key={index} className={`filter-field ${className}`}>
          <Skeleton className="skeleton-line short" />
          <Skeleton className="skeleton-control" />
        </div>
      ))}
    </div>
  );
}

/** Shown while a request page loads its data: the real title, then the filters, table and charts as placeholders. */
export function RequestsPageSkeleton({ trail, title, columns, children }: { trail: string[]; title: string; columns: number; children?: ReactNode }) {
  return (
    <AppShell trail={trail}>
      <div className="my-requests" role="status" aria-busy="true" aria-label={`Cargando ${title.toLowerCase()}`}>
        <Skeleton className="skeleton-eyebrow" />
        <h1 className="page-heading">{title}</h1>
        <Skeleton className="skeleton-description" />
        {children}
        <FiltersSkeleton />
        <div className="requests-layout">
          <TableSkeleton columns={columns} />
          <div className="requests-sidebar">
            <ChartCardSkeleton rows={4} />
            <ChartCardSkeleton rows={3} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** The catalog page while it loads: the category list and the selected panel. */
export function CatalogPageSkeleton() {
  return (
    <AppShell trail={["Solicitudes", "Catálogo"]}>
      <div className="my-requests" role="status" aria-busy="true" aria-label="Cargando el catálogo">
        <Skeleton className="skeleton-eyebrow" />
        <h1 className="page-heading">Catálogo de requerimientos</h1>
        <Skeleton className="skeleton-description" />
        <div className="catalog-layout">
          <div className="catalog-nav">
            {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="skeleton-nav-item" />)}
          </div>
          <div className="catalog-panel">
            <Skeleton className="skeleton-heading wide" />
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="skeleton-block" />)}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** A package's progress and requests while they load. */
export function PackageSkeleton() {
  return (
    <div className="package-skeleton" role="status" aria-busy="true" aria-label="Cargando el paquete">
      <div className="package-progress"><Skeleton className="skeleton-line short" /><Skeleton className="skeleton-bar" /></div>
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="package-child">
          <Skeleton className="skeleton-line" />
          <Skeleton className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
