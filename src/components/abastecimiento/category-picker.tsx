import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCategory, remainingCategories, removeCategory } from "@/lib/abastecimiento/vendors";

/**
 * The categories of a vendor, taken from the company's pool: the chosen ones are chips that can be taken off, the
 * rest of the pool is offered below to add with a click, and a new name typed in joins the choice (and the pool when
 * the vendor is saved). As a filter (`allowNew` off) it only picks what exists.
 */
export function CategoryPicker({ idPrefix, value, onChange, pool, allowNew = true, emptyText = "Ninguna categoría elegida todavía." }: {
  idPrefix: string; value: string[]; onChange: (value: string[]) => void; pool: string[]; allowNew?: boolean; emptyText?: string;
}) {
  const [draft, setDraft] = useState("");
  const available = remainingCategories(pool, value);
  const addDraft = () => { onChange(addCategory(value, draft, pool)); setDraft(""); };
  return (
    <div className="flex flex-col gap-2">
      <ul className="ab-chips" aria-label="Categorías elegidas">
        {value.length === 0 && <li className="ds-meta">{emptyText}</li>}
        {value.map(name => (
          <li key={name} className="ab-chip ab-chip--chosen">
            {name}
            <button type="button" aria-label={`Quitar la categoría ${name}`} onClick={() => onChange(removeCategory(value, name))}><X aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="ds-meta">Categorías de la empresa</span>
          <ul className="ab-chips">
            {available.map(name => (
              <li key={name}>
                <button type="button" className="ab-chip" onClick={() => onChange(addCategory(value, name, pool))}><Plus aria-hidden="true" />{name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {allowNew && (
        <div className="flex gap-2">
          <Input id={`${idPrefix}-new-category`} aria-label="Nueva categoría" placeholder="Nueva categoría…" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)}
            // Enter adds the category; it must not submit the form it is in.
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addDraft(); } }} />
          <Button type="button" variant="outline" disabled={draft.trim() === ""} onClick={addDraft}>Agregar</Button>
        </div>
      )}
    </div>
  );
}
