import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { normalizeForSearch } from "@/lib/elements";
import { searchElementSuggestions } from "@/lib/requests.functions";

export const ELEMENT_DEBOUNCE_MS = 350;

/**
 * Free-text element input ("Cargo", "Tipo de máquina"…) that suggests matches from the category's master catalog
 * as you type, after a short pause. Anything typed is accepted; whether it already exists is reported through
 * `onKnownChange` so the form can say it will wait for approval.
 */
export function ElementInput({ id, category, value, onChange, onKnownChange, disabled, placeholder }: {
  id: string; category: string; value: string; onChange: (value: string) => void;
  onKnownChange?: (known: boolean | null) => void; disabled?: boolean; placeholder?: string;
}) {
  const search = useServerFn(searchElementSuggestions);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);
  const listId = `${id}-suggestions`;
  const query = normalizeForSearch(value);

  useEffect(() => {
    if (!category.trim() || query.length < 2) { setSuggestions([]); setLoading(false); onKnownChange?.(query.length < 2 ? null : false); return; }
    const call = ++latest.current;
    setLoading(true);
    // Wait for a pause in typing before asking the server, and ignore answers to older keystrokes.
    const timer = setTimeout(() => {
      search({ data: { category, query: value } })
        .then(found => {
          if (call !== latest.current) return;
          setSuggestions(found); setActive(-1);
          onKnownChange?.(found.some(name => normalizeForSearch(name) === query));
        })
        .catch(() => { if (call === latest.current) { setSuggestions([]); onKnownChange?.(null); } })
        .finally(() => { if (call === latest.current) setLoading(false); });
    }, ELEMENT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [category, query]);

  const choose = (name: string) => { onChange(name); setOpen(false); setActive(-1); };
  const visible = open && suggestions.length > 0 && !(suggestions.length === 1 && normalizeForSearch(suggestions[0]!) === query);

  return (
    <div className="element-input">
      <div className="element-input-control">
        <Search aria-hidden="true" />
        <Input
          id={id} value={value} disabled={disabled} placeholder={placeholder} maxLength={120} autoComplete="off" className="requirement-control"
          role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={listId}
          {...(visible && active >= 0 && { "aria-activedescendant": `${listId}-${active}` })}
          onChange={event => { onChange(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={event => {
            if (!visible) return;
            if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => (index + 1) % suggestions.length); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index <= 0 ? suggestions.length : index) - 1); }
            else if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(suggestions[active]!); }
            else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          }}
        />
        {loading && <Loader2 className="animate-spin element-input-spinner" aria-hidden="true" />}
      </div>
      {visible && (
        <ul id={listId} role="listbox" className="element-suggestions">
          {suggestions.map((name, index) => (
            // onMouseDown keeps the input focused, so the choice is applied before the list closes.
            <li key={name} id={`${listId}-${index}`} role="option" aria-selected={index === active} className={index === active ? "active" : undefined} onMouseDown={event => { event.preventDefault(); choose(name); }}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
