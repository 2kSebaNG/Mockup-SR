import { useState } from "react";
import { CalendarRange, ChevronDown, X } from "lucide-react";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DateField } from "@/lib/my-requests";

// Filters keep dates as yyyy-mm-dd; the calendar works with local Date objects.
const toDate = (iso: string) => (iso ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : undefined);
const toIso = (date: Date | undefined) => (date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "");
const long = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" });

function summary(from: Date | undefined, to: Date | undefined) {
  if (!from && !to) return "Cualquier fecha";
  if (from && !to) return `Desde ${long.format(from)}`;
  if (!from && to) return `Hasta ${long.format(to)}`;
  // Same year: it is said once, at the end ("06 oct – 18 oct 2026").
  return from!.getFullYear() === to!.getFullYear() ? `${long.format(from!).replace(` ${from!.getFullYear()}`, "")} – ${long.format(to!)}` : `${long.format(from!)} – ${long.format(to!)}`;
}

const fieldLabels: Record<DateField, { label: string; option: string }> = {
  createdAt: { label: "Fecha de creación", option: "Creación" },
  dueDate: { label: "Fecha límite", option: "Límite" },
  resolvedAt: { label: "Fecha de resolución", option: "Resolución" },
};

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const daysAgo = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - days);

/** The ranges people ask for most, computed from today. */
function presets(today: Date): { label: string; from: Date; to: Date }[] {
  const quarter = Math.floor(today.getMonth() / 3) * 3;
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return [
    { label: "Últimos 7 días", from: daysAgo(today, 6), to: today },
    { label: "Últimos 30 días", from: daysAgo(today, 29), to: today },
    { label: "Este mes", from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfMonth(today) },
    { label: "Mes anterior", from: lastMonth, to: endOfMonth(lastMonth) },
    { label: "Este trimestre", from: new Date(today.getFullYear(), quarter, 1), to: new Date(today.getFullYear(), quarter + 3, 0) },
  ];
}

/**
 * One control for a date range: which date it reads (creation, due date or resolution), quick presets, and a shadcn
 * calendar in range mode inside a popover (two months on wide screens).
 */
export function DateRangeFilter({ id, field, from, to, onChange, onFieldChange }: { id: string; field: DateField; from: string; to: string; onChange: (range: { from: string; to: string }) => void; onFieldChange: (field: DateField) => void }) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const range: DateRange | undefined = from || to ? { from: toDate(from), to: toDate(to) } : undefined;
  const active = Boolean(from || to);
  return (
    <div className="filter-field filter-dates">
      <span id={`${id}-label`} className="filter-label">{fieldLabels[field].label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={`filter-trigger${active ? " active" : ""}`} aria-labelledby={`${id}-label ${id}-value`}>
            <CalendarRange aria-hidden="true" className="filter-trigger-icon" />
            <span id={`${id}-value`} className="filter-trigger-value">{summary(range?.from, range?.to)}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="date-range-popover">
          <div className="date-range-field">
            <span id={`${id}-field`}>Fecha de</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={field} aria-labelledby={`${id}-field`} onValueChange={value => value && onFieldChange(value as DateField)}>
              {(Object.keys(fieldLabels) as DateField[]).map(key => <ToggleGroupItem key={key} value={key}>{fieldLabels[key].option}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          <div className="date-range-body">
            <ul className="date-range-presets" aria-label="Períodos frecuentes">
              {presets(new Date()).map(preset => {
                const selected = from === toIso(preset.from) && to === toIso(preset.to);
                return (
                  <li key={preset.label}>
                    <Button type="button" variant={selected ? "secondary" : "ghost"} size="sm" aria-pressed={selected} onClick={() => onChange({ from: toIso(preset.from), to: toIso(preset.to) })}>{preset.label}</Button>
                  </li>
                );
              })}
            </ul>
            <Calendar
              mode="range"
              locale={es}
              numberOfMonths={mobile ? 1 : 2}
              defaultMonth={range?.from ?? new Date()}
              selected={range}
              onSelect={next => onChange({ from: toIso(next?.from), to: toIso(next?.to) })}
            />
          </div>
          <div className="date-range-footer">
            <span>{range?.from && !range.to ? "Elige la fecha final." : "Elige un período frecuente o la fecha inicial y la final."}</span>
            <div>
              <Button type="button" variant="ghost" size="sm" disabled={!active} onClick={() => onChange({ from: "", to: "" })}><X />Limpiar</Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>Listo</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
