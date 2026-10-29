import { useMemo, useState, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, ArrowUp, ArrowUpDown, ChartColumnBig, ChevronDown, Table2, ChevronLeft, ChevronRight, Search, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRangeFilter, type DateRangeVariant } from "@/components/requests/date-range-filter";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  requestStatuses, pendingStatuses, emptyFilters, defaultSort, dueState, filterRequests, sortRequests, paginate, daysBetween,
  type DateField, type MyRequest, type RequestStatus, type RequestFilters, type RequestSort, type SortKey,
} from "@/lib/my-requests";
import type { Person } from "@/lib/organization";

export const statusClass: Record<RequestStatus, string> = {
  "Enviada": "status-sent",
  "En revisión": "status-review",
  "En gestión": "status-managing",
  "Completada": "status-completed",
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

const pageSizes = [10, 25, 50];

/** The date the range reads when the viewer has not chosen one: due date in the table, creation in the dashboard. */
export const defaultDateField = (view: ViewMode): DateField => (view === "dashboard" ? "createdAt" : "dueDate");

/** Search, filters, sorting by creation or due date (newest first by default) and pagination shared by every request table. */
export function useRequestList<T extends MyRequest>(requests: T[], view: ViewMode = "tabla") {
  const fallbackField = defaultDateField(view);
  const [filters, setFilters] = useState<RequestFilters>(emptyFilters);
  const [sort, setSort] = useState<RequestSort>(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const categories = useMemo(() => [...new Set(requests.map(request => request.category))].sort((a, b) => a.localeCompare(b, "es")), [requests]);
  const dateField = filters.dateField ?? fallbackField;
  // The dashboard only filters by period; search, status and category stay set for when the table comes back.
  const applied = useMemo(() => (view === "dashboard" ? { ...emptyFilters, from: filters.from, to: filters.to, dateField: filters.dateField } : filters), [view, filters]);
  const visible = useMemo(() => sortRequests(filterRequests(requests, applied, fallbackField), sort), [requests, applied, sort, fallbackField]);
  // Everything but the status filter: the status chart keeps every bar while it is the one filtering.
  const statusScope = useMemo(() => filterRequests(requests, { ...applied, statuses: [] }, fallbackField), [requests, applied, fallbackField]);
  // Everything but the date range: charts over time count each event (creation, completion…) inside the period.
  const dateScope = useMemo(() => filterRequests(requests, { ...applied, from: "", to: "" }), [requests, applied]);
  const pageData = paginate(visible, page, pageSize);
  const updateFilters = (patch: Partial<RequestFilters>) => { setFilters(current => ({ ...current, ...patch })); setPage(1); };
  const toggleFilter = (key: "statuses" | "categories", option: string, checked: boolean) => {
    setFilters(current => {
      const values: string[] = current[key];
      return { ...current, [key]: checked ? [...new Set([...values, option])] : values.filter(value => value !== option) };
    });
    setPage(1);
  };
  // A column clicked for the first time starts where it is most useful: newest created, or soonest due.
  const sortBy = (key: SortKey) => { setSort(current => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: key === "createdAt" ? "desc" : "asc" }); setPage(1); };
  return { filters, dateField, updateFilters, toggleFilter, sort, sortBy, page, setPage, pageSize, setPageSize, categories, visible, statusScope, dateScope, pageData };
}
export type RequestList<T extends MyRequest = MyRequest> = ReturnType<typeof useRequestList<T>>;

const sortLabels: Record<SortKey, string> = { createdAt: "Fecha de creación", dueDate: "Fecha límite" };

/** A date column header that sorts the table; the active one shows its direction. */
export function SortableHead({ list, column }: { list: RequestList; column: SortKey }) {
  const { sort, sortBy } = list;
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`sort-button${active ? " active" : ""}`} onClick={() => sortBy(column)}>
        {sortLabels[column]}<Icon />
        <span className="sr-only">{active ? (sort.direction === "asc" ? "orden ascendente, cambiar a descendente" : "orden descendente, cambiar a ascendente") : "ordenar por esta columna"}</span>
      </button>
    </TableHead>
  );
}

/** The due date, with the estimated resolution date under it while the request waits on a decision. */
export function DueDateCell({ request }: { request: MyRequest }) {
  const estimate = request.estimatedResolution && pendingStatuses.includes(request.status) ? request.estimatedResolution : null;
  return <span className="date-cell">{formatDate(request.dueDate)}{estimate && <span className="estimate-cell" title="Fecha estimada de resolución">Estimada: {formatDate(estimate)}</span>}</span>;
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

/** A filter with several options in a popover, so the bar stays one row; the trigger says what is selected. */
function MultiSelectFilter({ label, options, selected, onToggle }: { label: string; options: readonly string[]; selected: string[]; onToggle: (option: string, checked: boolean) => void }) {
  const id = `filter-${label}`.replace(/\s+/g, "-").toLowerCase();
  const summary = selected.length === 0 ? "Todos" : selected.length === 1 ? selected[0] : `${selected.length} seleccionados`;
  return (
    <div className="filter-field">
      <span id={`${id}-label`} className="filter-label">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={`filter-trigger${selected.length ? " active" : ""}`} aria-labelledby={`${id}-label ${id}-value`}>
            <span id={`${id}-value`} className="filter-trigger-value">{summary}</span><ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="filter-popover">
          <ScrollArea type="auto" className="filter-popover-scroll">
          <fieldset className="filter-options">
            <legend className="sr-only">{label}</legend>
            {options.map(option => {
              const optionId = `${id}-${option}`.replace(/\s+/g, "-").toLowerCase();
              return (
                <label key={option} htmlFor={optionId} className="filter-option">
                  <Checkbox id={optionId} checked={selected.includes(option)} onCheckedChange={checked => onToggle(option, checked === true)} />
                  {option}
                </label>
              );
            })}
          </fieldset>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Search and filters in one bar above the table and charts, which both follow it. */
export function FiltersBar({ list, view = "tabla", layout }: { list: RequestList; view?: ViewMode; layout?: FilterLayout | undefined }) {
  const { filters, updateFilters, toggleFilter, categories } = list;
  const dates = (variant: DateRangeVariant, joined = false) => <DateRangeFilter id="filter-date" variant={variant} joined={joined} field={list.dateField} from={filters.from} to={filters.to} onChange={range => updateFilters(range)} onFieldChange={dateField => updateFilters({ dateField })} />;
  // The dashboard reads only the period: just that control, laid out as the layout being compared asks.
  if (view === "dashboard") {
    if (layout === "b") return <section className="filters-bar dates-only layout-b" aria-label="Período">{dates("inline", true)}</section>;
    if (layout === "c") return <section className="filters-bar dates-only layout-c" aria-label="Período">{dates("stacked", true)}<PeriodSummary list={list} /></section>;
    return <section className="filters-bar dates-only" aria-label="Período">{dates("stacked")}</section>;
  }
  const activeFilters = filters.statuses.length + filters.categories.length + (filters.from || filters.to ? 1 : 0);
  return (
    <section className="filters-bar" aria-label="Búsqueda y filtros">
      <div className="filter-field filter-search">
        <label htmlFor="request-search" className="filter-label">Buscar</label>
        <div className="search-input"><Search aria-hidden="true" /><Input id="request-search" type="search" placeholder="Código, ej. REQ-1234" value={filters.query} onChange={event => updateFilters({ query: event.target.value })} /></div>
      </div>
      <MultiSelectFilter label="Estado" options={requestStatuses} selected={filters.statuses} onToggle={(option, checked) => toggleFilter("statuses", option, checked)} />
      <MultiSelectFilter label="Categoría" options={categories} selected={filters.categories} onToggle={(option, checked) => toggleFilter("categories", option, checked)} />
      {dates("compact")}
      {activeFilters > 0 && <Button variant="ghost" className="filter-clear" onClick={() => updateFilters({ statuses: [], categories: [], from: "", to: "", dateField: null })}><X />Limpiar filtros ({activeFilters})</Button>}
    </section>
  );
}

/** Each request page shows its table or its dashboard; the choice lives in the URL (?vista=dashboard) so it can be shared. */
export type ViewMode = "tabla" | "dashboard";
export const parseView = (value: unknown): ViewMode | undefined => (value === "dashboard" ? "dashboard" : undefined);

const viewOptions: { value: ViewMode; label: string; icon: typeof Table2 }[] = [
  { value: "tabla", label: "Tabla", icon: Table2 },
  { value: "dashboard", label: "Dashboard", icon: ChartColumnBig },
];

/** Table / dashboard switch, both options visible so the current one and the other read at a glance. */
export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div className="view-toggle" role="group" aria-label="Vista de la página">
      {viewOptions.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" className="view-option" aria-pressed={view === value} onClick={() => onChange(value)}>
          <Icon aria-hidden="true" />{label}
        </button>
      ))}
    </div>
  );
}

/**
 * Layouts of the dashboard's period controls, to compare them (?filtros=a|b|c); without it, the current two rows.
 * a: in the page toolbar beside Tabla/Dashboard, no card. b: one row inside the card. c: two rows plus a summary.
 */
export const filterLayouts = ["a", "b", "c"] as const;
export type FilterLayout = (typeof filterLayouts)[number];
export type ViewSearch = { vista?: "dashboard"; filtros?: FilterLayout };
/** Keeps only valid ?vista= and ?filtros= values from the URL. */
export const viewSearch = (search: Record<string, unknown>): ViewSearch => {
  const layout = filterLayouts.find(value => value === search["filtros"]);
  return { ...(parseView(search["vista"]) && { vista: "dashboard" as const }), ...(layout && { filtros: layout }) };
};
/** The search with the view switched, without leaving an empty `vista` behind. */
export function withView<T extends ViewSearch>(search: T, view: ViewMode): T {
  const { vista: _previous, ...rest } = search;
  return (view === "dashboard" ? { ...rest, vista: "dashboard" } : rest) as T;
}

const rangeWords: Record<DateField, string> = { createdAt: "creadas", dueDate: "con fecha límite", resolvedAt: "resueltas" };
const rangeDate = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => rangeDate.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");
/** What the date range keeps, in words, for chart subtitles ("creadas entre 06 oct 2026 y 18 oct 2026"); null with no range. */
export function rangeScope(list: RequestList): string | null {
  const { from, to } = list.filters;
  if (!from && !to) return null;
  const words = rangeWords[list.dateField];
  if (from && to) return `${words} entre ${fmt(from)} y ${fmt(to)}`;
  return from ? `${words} desde ${fmt(from)}` : `${words} hasta ${fmt(to)}`;
}

/** The view switch and the filters above a request page; with layout "a", the dashboard's period joins the switch's row. */
export function RequestsToolbar({ list, view, onViewChange, layout }: { list: RequestList; view: ViewMode; onViewChange: (view: ViewMode) => void; layout?: FilterLayout | undefined }) {
  const { filters, updateFilters } = list;
  if (view === "dashboard" && layout === "a") {
    return (
      <div className="page-toolbar toolbar-a">
        <DateRangeFilter id="filter-date" variant="inline" joined field={list.dateField} from={filters.from} to={filters.to} onChange={range => updateFilters(range)} onFieldChange={dateField => updateFilters({ dateField })} />
        <ViewToggle view={view} onChange={onViewChange} />
      </div>
    );
  }
  return (
    <>
      <div className="page-toolbar"><ViewToggle view={view} onChange={onViewChange} /></div>
      <FiltersBar list={list} view={view} layout={layout} />
    </>
  );
}

/** Layout "c": what the chosen period holds, in the space beside its controls. */
function PeriodSummary({ list }: { list: RequestList }) {
  const scope = rangeScope(list);
  const completed = list.visible.filter(request => request.status === "Completada").length;
  return (
    <aside className="period-summary" aria-live="polite">
      <span>{scope ? "Período" : "Sin período"}</span>
      <strong>{list.visible.length} solicitudes</strong>
      <span>{completed} completadas · {scope ?? "todo el historial"}</span>
    </aside>
  );
}
