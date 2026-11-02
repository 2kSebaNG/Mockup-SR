import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Rows per page, "1–10 de 42" and previous / next, at the foot of a list. */
export function Pagination({ page, pageSize, totalCount, sizes = [10, 25, 50], onPage, onPageSize }: {
  page: number; pageSize: number; totalCount: number; sizes?: readonly number[]; onPage: (page: number) => void; onPageSize: (size: number) => void;
}) {
  const labelId = useId();
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount ? (page - 1) * pageSize + 1 : 0;
  return (
    <footer className="ds-pagination">
      <div className="ds-pagination-size">
        <span id={labelId}>Filas por página</span>
        <Select value={String(pageSize)} onValueChange={value => onPageSize(Number(value))}>
          <SelectTrigger aria-labelledby={labelId}><SelectValue /></SelectTrigger>
          <SelectContent>{sizes.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <span aria-live="polite">{totalCount ? `${start}–${Math.min(totalCount, page * pageSize)} de ${totalCount}` : "0 de 0"}</span>
      <div className="ds-pagination-buttons">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}><ChevronLeft />Anterior</Button>
        <span className="ds-pagination-page">Página {page} de {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount}>Siguiente<ChevronRight /></Button>
      </div>
    </footer>
  );
}

/** Page through an array on the client: the visible slice and the current page clamped to the last one. */
export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  return { current, pageCount, visible: rows.slice((current - 1) * pageSize, current * pageSize) };
}
