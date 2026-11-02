import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string; hint?: string | undefined };

/**
 * A choice among many, with search (a project, an account, a vendor): a button that opens a searchable list. The
 * search also matches the hint (a code, a RUT). `null` is "nothing chosen".
 */
export function Combobox({ id, options, value, onChange, placeholder = "Elegir…", searchPlaceholder = "Buscar…", empty = "Sin resultados.", disabled = false, className }: {
  id?: string; options: ComboboxOption[]; value: string | null; onChange: (value: string | null) => void;
  placeholder?: string; searchPlaceholder?: string; empty?: string; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className={cn("ds-combobox", !selected && "ds-combobox--empty", className)}>
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="ds-combobox-content" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem key={option.value} value={`${option.label} ${option.hint ?? ""} ${option.value}`} onSelect={() => { onChange(option.value === value ? null : option.value); setOpen(false); }}>
                  <Check aria-hidden="true" className={cn("ds-combobox-check", option.value !== value && "invisible")} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.hint && <span className="ds-meta truncate">{option.hint}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
