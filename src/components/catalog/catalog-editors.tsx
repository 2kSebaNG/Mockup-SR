import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { NoveltyEditor, itemTitle } from "@/components/requests/classification-review";
import { uniqueValues, type Catalog, type CatalogField, type CatalogGroup, type ItemEdit } from "@/lib/catalog";
import type { CatalogAction } from "@/lib/catalog-admin";
import { normalizeForSearch } from "@/lib/elements";
import { decideCatalogItems, manageCatalog } from "@/lib/requests.functions";

/** Runs one catalog edit and reloads the page data; resolves to an error message, or null when it worked. */
export function useCatalogAction() {
  const run = useServerFn(manageCatalog);
  const router = useRouter();
  return async (action: CatalogAction): Promise<string | null> => {
    try {
      const { error } = await run({ data: action });
      if (error) return error;
      await router.invalidate();
      return null;
    } catch { return "No se pudo guardar el cambio. Inténtalo de nuevo."; }
  };
}

/** Text that turns into an input on "Editar"; Enter saves, Escape cancels. */
export function EditableText({ value, label, onSave, children, maxLength = 80 }: { value: string; label: string; onSave: (value: string) => Promise<string | null>; children?: ReactNode; maxLength?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (draft.trim() === value) { setEditing(false); return; }
    setBusy(true); setError("");
    const failure = await onSave(draft.trim());
    setBusy(false);
    if (failure) setError(failure); else setEditing(false);
  };
  if (!editing) return (
    <span className="editable-text">
      {children ?? <span>{value}</span>}
      <Button type="button" variant="ghost" size="icon" className="editable-trigger" aria-label={`Editar ${label}`} title={`Editar ${label}`} onClick={() => { setDraft(value); setError(""); setEditing(true); }}><Pencil /></Button>
    </span>
  );
  return (
    <span className="editable-form">
      <Input autoFocus aria-label={label} value={draft} maxLength={maxLength} disabled={busy} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape") setEditing(false); }} />
      <Button type="button" size="icon" aria-label="Guardar" disabled={busy || !draft.trim()} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <Check />}</Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Cancelar" disabled={busy} onClick={() => setEditing(false)}><X /></Button>
      {error && <span role="alert" className="editable-error">{error}</span>}
    </span>
  );
}

/** A delete button that asks first and explains what happens. */
export function ConfirmDelete({ label, title, description, onConfirm, compact = true }: { label: string; title: string; description: ReactNode; onConfirm: () => Promise<string | null>; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    setBusy(true); setError("");
    const failure = await onConfirm();
    setBusy(false);
    if (failure) setError(failure); else setOpen(false);
  };
  return (
    <AlertDialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setError(""); } }}>
      <AlertDialogTrigger asChild>
        {compact
          ? <Button type="button" variant="ghost" size="icon" className="danger-icon" aria-label={label} title={label}><Trash2 /></Button>
          : <Button type="button" variant="outline" size="sm" className="danger-outline"><Trash2 />{label}</Button>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="requirement-error">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "destructive-solid" })} disabled={busy} onClick={event => { event.preventDefault(); void confirm(); }}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Small "add" form: one input and a button, clearing itself after a successful save. */
function AddInline({ label, placeholder, onAdd, maxLength = 100 }: { label: string; placeholder: string; onAdd: (value: string) => Promise<string | null>; maxLength?: number }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async () => {
    if (!value.trim()) return;
    setBusy(true); setError("");
    const failure = await onAdd(value.trim());
    setBusy(false);
    if (failure) setError(failure); else setValue("");
  };
  return (
    <div className="add-inline">
      <Input aria-label={label} placeholder={placeholder} value={value} maxLength={maxLength} disabled={busy} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} />
      <Button type="button" size="sm" variant="outline" disabled={busy || !value.trim()} onClick={add}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}Agregar</Button>
      {error && <p role="alert" className="editable-error">{error}</p>}
    </div>
  );
}

/** Categories that use an attribute, so editing a shared one shows who else is affected. */
export const categoriesUsing = (catalog: Catalog, fieldId: string) => catalog.categories.filter(category => category.fieldIds.includes(fieldId)).map(category => category.name);

/** One attribute with its options as removable chips. Within a category it can be unlinked; on the shared view, deleted. */
export function SelectCard({ field, catalog, category }: { field: CatalogField; catalog: Catalog; category?: string }) {
  const act = useCatalogAction();
  const usedBy = categoriesUsing(catalog, field.id);
  const others = usedBy.filter(name => name !== category);
  const [error, setError] = useState("");
  const removeOption = async (option: string) => { setError(""); const failure = await act({ action: "option.delete", id: field.id, option }); if (failure) setError(failure); };
  return (
    <article className="select-card">
      <header className="select-card-header">
        <EditableText value={field.label} label={`nombre del atributo ${field.label}`} onSave={label => act({ action: "field.rename", id: field.id, label })}><strong>{field.label}</strong></EditableText>
        <div className="select-card-actions">
          {category
            ? <ConfirmDelete label={`Quitar ${field.label} de ${category}`} title={`¿Quitar «${field.label}» de ${category}?`}
                description={<>Dejará de aparecer al pedir {category}. El atributo sigue existiendo{others.length ? <> y se mantiene en {others.join(", ")}</> : null}.</>}
                onConfirm={() => act({ action: "field.unlink", id: field.id, category })} />
            : <ConfirmDelete label={`Eliminar el atributo ${field.label}`} title={`¿Eliminar el atributo «${field.label}»?`}
                description={<>Se quitará de {usedBy.length ? usedBy.join(", ") : "todas las categorías"} y ya no se ofrecerá en Nueva solicitud. Las solicitudes existentes conservan lo que eligieron.</>}
                onConfirm={() => act({ action: "field.delete", id: field.id })} />}
        </div>
      </header>
      {others.length > 0 && <p className="select-card-note">{category ? "También se usa en" : "Se usa en"}: {others.join(", ")}{category ? ". Los cambios de nombre y opciones afectan a todas." : ""}</p>}
      {!category && usedBy.length === 0 && <p className="select-card-note">No está asociado a ninguna categoría.</p>}
      <ul className="option-chips" aria-label={`Opciones de ${field.label}`}>
        {field.options.map(option => (
          <li key={option} className="option-chip">{option}<button type="button" aria-label={`Quitar la opción ${option}`} title={`Quitar ${option}`} onClick={() => removeOption(option)}><X /></button></li>
        ))}
        {field.options.length === 0 && <li className="select-card-note">Sin opciones.</li>}
      </ul>
      {error && <p role="alert" className="editable-error">{error}</p>}
      <AddInline label={`Nueva opción para ${field.label}`} placeholder="Nueva opción" onAdd={option => act({ action: "option.add", id: field.id, option })} />
    </article>
  );
}

/** Attributes of a category, plus adding an existing attribute or creating a new one. */
export function SelectsTab({ catalog, category }: { catalog: Catalog; category: string }) {
  const act = useCatalogAction();
  const linked = catalog.categories.find(entry => entry.name === category)?.fieldIds ?? [];
  const fields = linked.flatMap(id => catalog.fields.filter(field => field.id === id));
  const available = catalog.fields.filter(field => !linked.includes(field.id));
  const [existing, setExisting] = useState("");
  const [label, setLabel] = useState("");
  const [options, setOptions] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action: CatalogAction, reset: () => void) => { setBusy(true); setError(""); const failure = await act(action); setBusy(false); if (failure) setError(failure); else reset(); };
  return (
    <div className="catalog-tab">
      {fields.length === 0 && <p className="catalog-empty">{category} todavía no tiene atributos. Agrega uno existente o crea uno nuevo.</p>}
      <div className="select-grid">{fields.map(field => <SelectCard key={field.id} field={field} catalog={catalog} category={category} />)}</div>
      <section className="add-select">
        <h4>Agregar un atributo a {category}</h4>
        <div className="add-select-row">
          <Select value={existing} onValueChange={setExisting} disabled={busy || available.length === 0}>
            <SelectTrigger aria-label="Atributo existente" className="add-select-trigger"><SelectValue placeholder={available.length ? "Elegir un atributo existente" : "No quedan atributos por agregar"} /></SelectTrigger>
            <SelectContent>{available.map(field => <SelectItem key={field.id} value={field.id}>{field.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" disabled={busy || !existing} onClick={() => run({ action: "field.link", id: existing, category }, () => setExisting(""))}><Plus />Agregar</Button>
        </div>
        <div className="add-select-row">
          <Input aria-label="Nombre del atributo nuevo" placeholder="O crea uno nuevo: nombre (ej. Talla)" value={label} maxLength={80} disabled={busy} onChange={event => setLabel(event.target.value)} />
          <Input aria-label="Opciones del atributo nuevo" placeholder="Opciones separadas por coma (ej. S, M, L)" value={options} maxLength={3000} disabled={busy} onChange={event => setOptions(event.target.value)} />
          <Button type="button" size="sm" disabled={busy || !label.trim() || !options.trim()} onClick={() => run({ action: "field.create", label: label.trim(), options: uniqueValues(options.split(",")).slice(0, 30), categories: [category] }, () => { setLabel(""); setOptions(""); })}><Plus />Crear</Button>
        </div>
        {error && <p role="alert" className="editable-error">{error}</p>}
      </section>
    </div>
  );
}

/** The category's master catalog: filter, add, rename (old name kept as alias) and delete elements. */
export function ElementsTab({ category, elementLabel, elements }: { category: string; elementLabel: string; elements: { name: string; aliases: string[] }[] }) {
  const act = useCatalogAction();
  const [filter, setFilter] = useState("");
  const wanted = normalizeForSearch(filter);
  const sorted = [...elements].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const visible = wanted ? sorted.filter(element => [element.name, ...element.aliases].some(name => normalizeForSearch(name).includes(wanted))) : sorted;
  return (
    <div className="catalog-tab">
      <div className="elements-toolbar">
        <div className="search-input"><Search aria-hidden="true" /><Input type="search" aria-label={`Filtrar ${elementLabel.toLowerCase()}`} placeholder={`Filtrar ${elementLabel.toLowerCase()}…`} value={filter} onChange={event => setFilter(event.target.value)} /></div>
        <AddInline label={`Nuevo ${elementLabel.toLowerCase()}`} placeholder={`Nuevo ${elementLabel.toLowerCase()}`} maxLength={120} onAdd={name => act({ action: "element.add", category, name })} />
      </div>
      {visible.length === 0
        ? <p className="catalog-empty">{elements.length ? "Ningún elemento coincide con el filtro." : `El catálogo maestro de ${category} está vacío.`}</p>
        : <ul className="element-rows">
            {visible.map(element => (
              <li key={element.name}>
                <EditableText value={element.name} label={`${element.name}`} maxLength={120} onSave={to => act({ action: "element.rename", category, name: element.name, to })}>
                  <span>{element.name}{element.aliases.length > 0 && <span className="element-aliases">también: {element.aliases.join(", ")}</span>}</span>
                </EditableText>
                <ConfirmDelete label={`Eliminar ${element.name}`} title={`¿Eliminar «${element.name}» del catálogo maestro?`}
                  description={<>Dejará de sugerirse al escribir el {elementLabel.toLowerCase()} en {category}. Las solicitudes que ya lo usan no cambian.</>}
                  onConfirm={() => act({ action: "element.delete", category, name: element.name })} />
              </li>
            ))}
          </ul>}
      <p className="catalog-count">{elements.length === 1 ? "1 elemento" : `${elements.length} elementos`}{wanted && ` · ${visible.length} con el filtro`}</p>
    </div>
  );
}

/** Pending novelties, each decided once for every request that proposes it. */
export function PendingList({ groups, catalog }: { groups: CatalogGroup[]; catalog: Catalog }) {
  const decide = useServerFn(decideCatalogItems);
  const router = useRouter();
  const onDecide = (group: CatalogGroup) => async (status: "aprobada" | "rechazada", edit: ItemEdit) => {
    const response = await decide({ data: { targets: group.targets, status, edit } });
    if (response.error) return response.error;
    await router.invalidate();
    return null;
  };
  return (
    <ul className="novelty-list">
      {groups.map(group => (
        <li key={group.id} className="catalog-part pending-card">
          <div className="catalog-part-heading">
            <p className="catalog-part-summary">{itemTitle(group)}</p>
            <span className="novelty-count">{group.requests.length === 1 ? "1 solicitud" : `${group.requests.length} solicitudes`}</span>
          </div>
          <p className="catalog-options">Propuesto en {group.requests.map(r => `${r.code} (${r.requester})`).join(", ")}</p>
          <NoveltyEditor key={`${group.id}-${catalog.fields.length}-${catalog.categories.length}`} item={{ ...group, options: group.kind === "field" ? group.options : undefined }} catalog={catalog} onDecide={onDecide(group)} />
        </li>
      ))}
    </ul>
  );
}
