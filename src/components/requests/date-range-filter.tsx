import { useState } from "react";
import { CalendarRange, ChevronDown, X } from "lucide-react";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

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

/** One control for a date range: a shadcn calendar in range mode inside a popover (two months on wide screens). */
export function DateRangeFilter({ id, label, from, to, onChange }: { id: string; label: string; from: string; to: string; onChange: (range: { from: string; to: string }) => void }) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const range: DateRange | undefined = from || to ? { from: toDate(from), to: toDate(to) } : undefined;
  const active = Boolean(from || to);
  return (
    <div className="filter-field filter-dates">
      <span id={`${id}-label`} className="filter-label">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={`filter-trigger${active ? " active" : ""}`} aria-labelledby={`${id}-label ${id}-value`}>
            <CalendarRange aria-hidden="true" className="filter-trigger-icon" />
            <span id={`${id}-value`} className="filter-trigger-value">{summary(range?.from, range?.to)}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="date-range-popover">
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
  );
}
