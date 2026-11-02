import { Skeleton } from "@/components/ui/skeleton";

/** A list while it loads: the header and a few rows, shaped like `DataList`. */
export function DataListSkeleton({ label, columns, rows = 6 }: { label: string; columns: number; rows?: number }) {
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <div className="ds-panel ds-panel--flush ds-list-skeleton" role="status" aria-busy="true" aria-label={`Cargando ${label.toLowerCase()}`}>
      <div className="ds-list-skeleton-row head" style={grid}>{Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-3 w-2/3" />)}</div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="ds-list-skeleton-row" style={grid}>
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={column % 3 === 1 ? "h-3 w-1/2" : "h-3 w-4/5"} />)}
        </div>
      ))}
    </div>
  );
}
