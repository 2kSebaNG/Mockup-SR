import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Numbers and dates read better aligned to the end. */
  align?: "start" | "end";
  /**
   * Where the column goes in the card each row becomes when the list is narrow: `title` stacks at the top
   * (name, then its secondary line), `field` is a label → value pair (default), `hidden` is left out.
   */
  card?: "title" | "field" | "hidden";
  /** The card's label when `header` is not plain text. */
  cardLabel?: ReactNode;
  className?: string;
};

/**
 * A list from one column definition: a table while it fits and a card per row when its own width drops under
 * `collapseAt` (sm 600, md 880, lg 1100 px), so status and actions never hide off-screen. It measures the list,
 * not the window, so it also folds beside an open sidebar. `footer` takes the `Pagination`.
 */
export function DataList<T>({ label, rows, columns, rowKey, actions, empty = "No hay resultados.", collapseAt = "md", footer, className }: {
  label: string; rows: T[]; columns: DataColumn<T>[]; rowKey: (row: T) => string; actions?: (row: T) => ReactNode;
  empty?: ReactNode; collapseAt?: "sm" | "md" | "lg"; footer?: ReactNode; className?: string;
}) {
  const titles = columns.filter(column => column.card === "title");
  const fields = columns.filter(column => (column.card ?? "field") === "field");
  const span = columns.length + (actions ? 1 : 0);
  const end = (column: DataColumn<T>) => (column.align === "end" ? "ds-align-end" : undefined);
  return (
    <section className={cn("ds-panel ds-panel--flush ds-data", `ds-data--${collapseAt}`, className)} aria-label={label}>
      <div className="ds-table-wrap">
        <Table className="ds-table">
          <TableHeader>
            <TableRow>
              {columns.map(column => <TableHead key={column.key} className={end(column)}>{column.header}</TableHead>)}
              {actions && <TableHead className="ds-align-end">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={span} className="ds-data-empty">{empty}</TableCell></TableRow>}
            {rows.map(row => (
              <TableRow key={rowKey(row)}>
                {columns.map(column => <TableCell key={column.key} className={cn(end(column), column.className)}>{column.cell(row)}</TableCell>)}
                {actions && <TableCell className="ds-cell-actions">{actions(row)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="ds-cards" aria-label={label}>
        {rows.length === 0 && <li className="ds-data-empty">{empty}</li>}
        {rows.map(row => (
          <li key={rowKey(row)}>
            <div className="ds-card-head">
              <div className="ds-card-title">{titles.map(column => <div key={column.key}>{column.cell(row)}</div>)}</div>
              {actions && <div className="ds-card-actions">{actions(row)}</div>}
            </div>
            {fields.length > 0 && (
              <dl className="ds-card-fields">
                {fields.map(column => (
                  <div key={column.key}>
                    <dt>{column.cardLabel ?? column.header}</dt>
                    <dd>{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
      {footer}
    </section>
  );
}
