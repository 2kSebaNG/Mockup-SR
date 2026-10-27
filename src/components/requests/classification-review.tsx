import { useEffect, useId, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ElementInput } from "@/components/requests/element-input";
import { defaultCatalog, findCategory, findField, uniqueValues, type Catalog, type CatalogItem, type CatalogItemKind, type ItemEdit, type ItemStatus } from "@/lib/catalog";
import type { ReviewedRequest } from "@/lib/my-requests";
import { decideCatalogItems, getCatalog } from "@/lib/requests.functions";

const statusText: Record<ItemStatus, string> = { pendiente: "Pendiente", aprobada: "Agregado al catálogo", rechazada: "No agregado" };

/** Marks a novelty inside a request: amber while pending, green once in the catalog, grey if rejected. */
export function NoveltyTag({ status, pendingLabel = "Nuevo", as }: { status: ItemStatus; pendingLabel?: string; as?: string | undefined }) {
  return <span className={`novelty-tag novelty-${status}`}>{status === "pendiente" ? pendingLabel : statusText[status]}{status === "aprobada" && as ? ` como «${as}»` : ""}</span>;
}

export function itemTitle(item: { kind: CatalogItemKind; name: string; category: string; field?: string | undefined }) {
  if (item.kind === "type") return <>Categoría nueva <strong>«{item.name}»</strong></>;
  if (item.kind === "element") return <>Elemento nuevo <strong>«{item.name}»</strong> <span className="novelty-context">en el catálogo maestro de {item.category}</span></>;
  if (item.kind === "field") return <>Atributo nuevo <strong>«{item.name}»</strong> <span className="novelty-context">en {item.category}</span></>;
  if (item.kind === "link") return <>Asociar el atributo <strong>«{item.name}»</strong> <span className="novelty-context">a la categoría {item.category}</span></>;
  return <>Opción nueva <strong>«{item.name}»</strong> <span className="novelty-context">en el atributo {item.field}</span></>;
}

/** Existing names the administrator can map a novelty to instead of creating it. */
function existingNames(catalog: Catalog, item: { kind: CatalogItemKind; field?: string | undefined }) {
  if (item.kind === "type") return catalog.categories.map(category => category.name);
  if (item.kind === "field") return catalog.fields.map(field => field.label);
  if (item.kind === "option") return findField(catalog, item.field ?? "")?.options ?? [];
  return [];
}

function existingMatch(catalog: Catalog, item: { kind: CatalogItemKind; field?: string | undefined }, name: string) {
  const wanted = name.trim().toLocaleLowerCase("es");
  if (!wanted) return undefined;
  if (item.kind === "type") return findCategory(catalog, name)?.name;
  if (item.kind === "field") return findField(catalog, name)?.label;
  if (item.kind === "option") return findField(catalog, item.field ?? "")?.options.find(option => option.toLocaleLowerCase("es") === wanted);
  return undefined;
}

/**
 * Approve or reject one novelty. Before approving, the administrator may correct its name (or type the name of an
 * existing one to merge into it) and, for a new select, adjust its options.
 */
export function NoveltyEditor({ item, catalog, onDecide }: { item: { kind: CatalogItemKind; name: string; category: string; field?: string | undefined; options?: string[] | undefined }; catalog: Catalog; onDecide: (status: "aprobada" | "rechazada", edit: ItemEdit) => Promise<string | null> }) {
  const id = useId();
  const [name, setName] = useState(item.name);
  const [options, setOptions] = useState((item.options ?? []).join(", "));
  const [busy, setBusy] = useState<"aprobada" | "rechazada" | null>(null);
  const [error, setError] = useState("");
  const editable = item.kind !== "link";
  // Elements are looked up in the category's master catalog through the same suggestions as the request form.
  const [elementMatch, setElementMatch] = useState<boolean | null>(null);
  const match = item.kind === "element" ? (elementMatch ? name.trim() : undefined) : editable ? existingMatch(catalog, item, name) : undefined;
  const optionList = uniqueValues(options.split(",")).slice(0, 30);

  const decide = async (status: "aprobada" | "rechazada") => {
    if (status === "aprobada" && editable && !name.trim()) { setError("Escribe el nombre con que se guardará."); return; }
    setBusy(status); setError("");
    const edit: ItemEdit = status === "aprobada" ? { ...(editable && name.trim() !== item.name && { as: name.trim() }), ...(item.kind === "field" && { options: optionList }) } : {};
    const failure = await onDecide(status, edit).catch(() => "No se pudo guardar la decisión. Inténtalo de nuevo.");
    if (failure) setError(failure);
    setBusy(null);
  };

  return (
    <div className="novelty-editor">
      {editable && <div className="novelty-fields">
        <label htmlFor={`${id}-name`}>Guardar como</label>
        {item.kind === "element"
          ? <ElementInput id={`${id}-name`} category={item.category} value={name} onChange={setName} onKnownChange={setElementMatch} disabled={busy !== null} />
          : <>
            <Input id={`${id}-name`} list={`${id}-existing`} value={name} maxLength={80} disabled={busy !== null} onChange={event => setName(event.target.value)} />
            <datalist id={`${id}-existing`}>{existingNames(catalog, item).map(existing => <option key={existing} value={existing} />)}</datalist>
          </>}
        {item.kind === "field" && <>
          <label htmlFor={`${id}-options`}>Opciones, separadas por coma</label>
          <Input id={`${id}-options`} value={options} maxLength={3000} disabled={busy !== null} onChange={event => setOptions(event.target.value)} />
        </>}
        <p className="novelty-hint">{match ? <>Ya existe <strong>«{match}»</strong>: se unirá a {item.kind === "option" ? "esa opción" : item.kind === "type" ? "esa categoría" : item.kind === "element" ? "ese elemento" : "ese atributo"} en vez de crear uno nuevo.</> : name.trim() !== item.name ? <>Se guardará corregido como <strong>«{name.trim()}»</strong>.</> : "Escribe otro nombre para corregirlo, o el de uno existente para unirlo."}</p>
      </div>}
      <div className="catalog-actions">
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => decide("rechazada")}>{busy === "rechazada" ? <Loader2 className="animate-spin" /> : <X />}Rechazar</Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy !== null || (item.kind === "field" && optionList.length === 0)} onClick={() => decide("aprobada")}>{busy === "aprobada" ? <Loader2 className="animate-spin" /> : <Check />}Aprobar</Button>
      </div>
      {error && <p role="alert" className="requirement-error">{error}</p>}
    </div>
  );
}

/** The approved catalog, loaded on demand for the editors (falls back to the built-in one). */
export function useCatalog(enabled: boolean) {
  const load = useServerFn(getCatalog);
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    load().then(next => { if (active) setCatalog(next); }).catch(() => { /* keep the built-in catalog */ });
    return () => { active = false; };
  }, [enabled]);
  return catalog;
}

/** Every novelty of a request, each decidable on its own by the contract administrator. */
export function ClassificationReview({ request, onReviewed }: { request: ReviewedRequest; onReviewed: () => Promise<void> }) {
  const decide = useServerFn(decideCatalogItems);
  const catalog = useCatalog(request.review !== null);
  const review = request.review;
  if (!review) return null;
  const onDecide = (item: CatalogItem) => async (status: "aprobada" | "rechazada", edit: ItemEdit) => {
    const response = await decide({ data: { targets: [{ code: request.code, key: item.key }], status, edit } });
    if (response.error) return response.error;
    await onReviewed();
    return null;
  };
  return (
    <section className="catalog-review" aria-label="Novedades para el catálogo">
      <h3 className="request-content-heading"><Tags aria-hidden="true" />Novedades para el catálogo</h3>
      <p className="catalog-review-help">Nada de esto está en el catálogo todavía. Revisa cada novedad: corrígela si hace falta y apruébala para que quede disponible en Nueva solicitud, o recházala.</p>
      <ul className="novelty-list">
        {review.items.map(item => (
          <li key={item.key} className="catalog-part">
            <div className="catalog-part-heading"><p className="catalog-part-summary">{itemTitle(item)}</p><NoveltyTag status={item.status} as={item.as} /></div>
            {item.kind === "field" && item.status !== "pendiente" && item.options && <p className="catalog-options">Opciones: {item.options.join(", ")}</p>}
            {item.status === "pendiente" && <NoveltyEditor key={`${item.key}-${catalog.fields.length}`} item={item} catalog={catalog} onDecide={onDecide(item)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
