import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  requestStatuses, emptyFilters, dueState, filterRequests, sortByDueDate, paginate, daysBetween,
  type MyRequest, type RequestStatus, type RequestFilters, type SortDirection,
} from "@/lib/my-requests";
import type { Person } from "@/lib/organization";

export const statusClass: Record<RequestStatus, string> = {
  "Enviada": "status-sent",
  "En revisión": "status-review",
  "Autorizado": "status-authorized",
  "Rechazado": "status-rejected",
  "Anulado": "status-cancelled",
};

const dateFormat = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));
/** dd/mm/aaaa, as in the reference designs ("Solicitado por: … el 20/05/2026"). */
export const formatNumericDate = (iso: string) => iso.split("-").reverse().join("/");

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`status-badge ${statusClass[status]}`}>{status}</span>;
}

export function DueWarning({ request, today }: { request: MyRequest; today: string }) {
  const state = dueState(request, today);
  if (!state) return null;
  const left = daysBetween(today, request.dueDate);
  const text = state === "overdue" ? `Vencida hace ${-left} ${-left === 1 ? "día" : "días"}` : left === 0 ? "Vence hoy" : `Vence en ${left} ${left === 1 ? "día" : "días"}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`due-warning ${state}`} role="img" aria-label={text} tabIndex={0}><TriangleAlert /></span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** A person's name as a link that opens the internal chat with them. */
export function PersonLink({ person, onOpen }: { person: Person; onOpen: () => void }) {
  return <button type="button" className="authorizer-link" onClick={onOpen} title={`Abrir chat interno con ${person.name}`}>{person.name}</button>;
}

export function ActionButton({ label, onClick, disabled, children, reason }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; reason?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The wrapper keeps the tooltip reachable when the button is disabled. */}
        <span tabIndex={disabled ? 0 : -1} className="action-wrapper">
          <Button variant="ghost" size="icon" className="row-action" aria-label={label} disabled={disabled} onClick={onClick}>{children}</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabled && reason ? reason : label}</TooltipContent>
    </Tooltip>
  );
}

export type SummaryCard = { status: RequestStatus; label: string; icon: ReactNode };

export function SummaryCards({ cards, counts }: { cards: SummaryCard[]; counts: Record<RequestStatus, number> }) {
  return (
    <section className="summary-cards" aria-label="Resumen de solicitudes">
      {cards.map(card => (
        <article key={card.status} className={`summary-card ${statusClass[card.status]}`}>
          <span className="summary-icon" aria-hidden="true">{card.icon}</span>
          <div><strong>{counts[card.status]}</strong><span>{card.label}</span></div>
        </article>
      ))}
    </section>
  );
}

const pageSizes = [10, 25, 50];

/** Search, filters, due-date sorting and pagination shared by the requester and administrator tables. */
export function useRequestList<T extends MyRequest>(requests: T[]) {
  const [filters, setFilters] = useState<RequestFilters>(emptyFilters);
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const categories = useMemo(() => [...new Set(requests.map(request => request.category))].sort((a, b) => a.localeCompare(b, "es")), [requests]);
  const visible = useMemo(() => sortByDueDate(filterRequests(requests, filters), direction), [requests, filters, direction]);
  const pageData = paginate(visible, page, pageSize);
  const updateFilters = (patch: Partial<RequestFilters>) => { setFilters(current => ({ ...current, ...patch })); setPage(1); };
  const toggleFilter = (key: "statuses" | "categories", option: string, checked: boolean) => {
    setFilters(current => {
      const values: string[] = current[key];
      return { ...current, [key]: checked ? [...new Set([...values, option])] : values.filter(value => value !== option) };
    });
    setPage(1);
  };
  return { filters, updateFilters, toggleFilter, direction, setDirection, page, setPage, pageSize, setPageSize, categories, visible, pageData };
}
export type RequestList<T extends MyRequest = MyRequest> = ReturnType<typeof useRequestList<T>>;

export function DueDateHead({ list }: { list: RequestList }) {
  const { direction, setDirection } = list;
  return (
    <TableHead aria-sort={direction === "asc" ? "ascending" : "descending"}>
      <button type="button" className="sort-button" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}>
        Fecha límite{direction === "asc" ? <ArrowUp /> : <ArrowDown />}
        <span className="sr-only">{direction === "asc" ? "orden ascendente, cambiar a descendente" : "orden descendente, cambiar a ascendente"}</span>
      </button>
    </TableHead>
  );
}

export function PaginationFooter({ list }: { list: RequestList }) {
  const { pageData, visible, pageSize, setPageSize, setPage } = list;
  return (
    <footer className="pagination">
      <div className="page-size">
        <span id="page-size-label">Filas por página</span>
        <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
          <SelectTrigger aria-labelledby="page-size-label" className="page-size-trigger"><SelectValue /></SelectTrigger>
          <SelectContent>{pageSizes.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <span className="page-range" aria-live="polite">{visible.length ? `${pageData.start + 1}–${pageData.end} de ${visible.length}` : "0 de 0"}</span>
      <div className="page-buttons">
        <Button variant="outline" size="sm" onClick={() => setPage(pageData.page - 1)} disabled={pageData.page <= 1}><ChevronLeft />Anterior</Button>
        <span className="page-number">Página {pageData.page} de {pageData.pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(pageData.page + 1)} disabled={pageData.page >= pageData.pageCount}>Siguiente<ChevronRight /></Button>
      </div>
    </footer>
  );
}

function FilterGroup({ title, options, selected, onToggle }: { title: string; options: readonly string[]; selected: string[]; onToggle: (option: string, checked: boolean) => void }) {
  return (
    <fieldset className="filter-group">
      <legend>{title}</legend>
      {options.map(option => {
        const id = `${title}-${option}`.replace(/\s+/g, "-").toLowerCase();
        return (
          <label key={option} htmlFor={id} className="filter-option">
            <Checkbox id={id} checked={selected.includes(option)} onCheckedChange={checked => onToggle(option, checked === true)} />
            {option}
          </label>
        );
      })}
    </fieldset>
  );
}

export function FiltersAside({ list, note }: { list: RequestList; note: string }) {
  const { filters, updateFilters, toggleFilter, categories } = list;
  const activeFilters = filters.statuses.length + filters.categories.length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0);
  return (
    <aside className="requests-sidebar" aria-label="Búsqueda y filtros">
      <div className="search-box">
        <label htmlFor="request-search">Buscar</label>
        <div className="search-input"><Search aria-hidden="true" /><Input id="request-search" type="search" placeholder="Código, ej. REQ-1234" value={filters.query} onChange={event => updateFilters({ query: event.target.value })} /></div>
      </div>
      <section className="filter-panel">
        <div className="filter-heading"><h2>Filtrar</h2>{activeFilters > 0 && <Button variant="link" size="sm" onClick={() => updateFilters({ statuses: [], categories: [], from: "", to: "" })}>Limpiar ({activeFilters})</Button>}</div>
        <FilterGroup title="Estado" options={requestStatuses} selected={filters.statuses} onToggle={(option, checked) => toggleFilter("statuses", option, checked)} />
        <FilterGroup title="Categoría" options={categories} selected={filters.categories} onToggle={(option, checked) => toggleFilter("categories", option, checked)} />
        <fieldset className="filter-group">
          <legend>Rango de fecha límite</legend>
          <div className="date-range">
            <label>Desde<Input type="date" value={filters.from} max={filters.to || undefined} onChange={event => updateFilters({ from: event.target.value })} /></label>
            <label>Hasta<Input type="date" value={filters.to} min={filters.from || undefined} onChange={event => updateFilters({ to: event.target.value })} /></label>
          </div>
        </fieldset>
      </section>
      <p className="requests-note"><Info aria-hidden="true" />{note}</p>
    </aside>
  );
}
