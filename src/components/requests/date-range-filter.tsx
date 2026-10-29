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
function presets(today: Date): { key: string; label: string; from: Date; to: Date }[] {
  const quarter = Math.floor(today.getMonth() / 3) * 3;
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return [
    { key: "7d", label: "7 días", from: daysAgo(today, 6), to: today },
    { key: "30d", label: "30 días", from: daysAgo(today, 29), to: today },
    { key: "mes", label: "Este mes", from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfMonth(today) },
    { key: "mes-anterior", label: "Mes anterior", from: lastMonth, to: endOfMonth(lastMonth) },
    { key: "trimestre", label: "Trimestre", from: new Date(today.getFullYear(), quarter, 1), to: new Date(today.getFullYear(), quarter + 3, 0) },
  ];
}

/**
 * A date range: a popover with which date it reads (creation, due date or resolution) and a shadcn calendar in range
 * mode (two months on wide screens); with `presets`, quick periods beside it (the dashboard, where the period is the only filter).
 */
export function DateRangeFilter({ id, field, from, to, onChange, onFieldChange, presets: withPresets = false }: { id: string; field: DateField; from: string; to: string; onChange: (range: { from: string; to: string }) => void; onFieldChange: (field: DateField) => void; presets?: boolean }) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const range: DateRange | undefined = from || to ? { from: toDate(from), to: toDate(to) } : undefined;
  const active = Boolean(from || to);
  const options = presets(new Date());
  const preset = options.find(option => from === toIso(option.from) && to === toIso(option.to))?.key ?? "";
  return (
    <div className="filter-field filter-dates">
      <span id={`${id}-label`} className="filter-label">{fieldLabels[field].label}</span>
      <div className="date-filter-row">
        {/* Pressing the active preset again clears the range. */}
      {withPresets && <ToggleGroup type="single" variant="outline" size="sm" className="date-presets" aria-label="Períodos frecuentes" value={preset}
        onValueChange={value => { const chosen = options.find(option => option.key === value); onChange(chosen ? { from: toIso(chosen.from), to: toIso(chosen.to) } : { from: "", to: "" }); }}>
        {options.map(option => <ToggleGroupItem key={option.key} value={option.key}>{option.label}</ToggleGroupItem>)}
      </ToggleGroup>}
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
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={mobile ? 1 : 2}
            defaultMonth={range?.from ?? new Date()}
            selected={range}
            onSelect={next => onChange({ from: toIso(next?.from), to: toIso(next?.to) })}
          />
          <div className="date-range-footer">
            <span>{range?.from && !range.to ? "Elige la fecha final." : "Elige la fecha inicial y la final."}</span>
            <div>
              <Button type="button" variant="ghost" size="sm" disabled={!active} onClick={() => onChange({ from: "", to: "" })}><X />Limpiar</Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>Listo</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      </div>
    </div>
  );
}
