import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CatalogPageSkeleton } from "@/components/requests/request-skeletons";
import { useState, type ReactNode } from "react";
import { FolderPlus, Inbox, Layers, ListChecks, ListPlus, Loader2, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDelete, EditableText, ElementsTab, PendingList, SelectCard, SelectsTab, useCatalogAction } from "@/components/catalog/catalog-editors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { findCategory, uniqueValues, type Catalog, type CatalogGroup } from "@/lib/catalog";
import { DEFAULT_ELEMENT_LABEL, normalizeForSearch } from "@/lib/elements";
import { getCatalogReview } from "@/lib/requests.functions";

type CatalogSearch = { ver?: string };

export const Route = createFileRoute("/catalogo")({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => (typeof search["ver"] === "string" ? { ver: search["ver"] } : {}),
  loader: () => getCatalogReview(),
  pendingComponent: CatalogPageSkeleton,
  component: CatalogPage,
  head: () => ({ meta: [
    { title: "Catálogo | Ecosistema X" },
    { name: "description", content: "Categorías, catálogos maestros, atributos y opciones de los requerimientos, y las novedades que esperan aprobación." },
    { property: "og:title", content: "Catálogo | Ecosistema X" },
    { property: "og:description", content: "Gestiona el catálogo de requerimientos por categoría." },
  ] }),
});

type Masters = Record<string, { name: string; aliases: string[] }[]>;

const same = (a: string, b: string) => normalizeForSearch(a) === normalizeForSearch(b);
const mastersOf = (masters: Masters, name: string) => Object.entries(masters).find(([key]) => same(key, name))?.[1] ?? [];

/** Pending novelties that belong to a category (by its name or a former name). */
function pendingFor(catalog: Catalog, groups: CatalogGroup[], category: string) {
  const known = findCategory(catalog, category);
  return groups.filter(group => known ? findCategory(catalog, group.category) === known : same(group.category, category));
}

function NewCategoryForm({ onCreated }: { onCreated: (name: string) => void }) {
  const act = useCatalogAction();
  const [name, setName] = useState("");
  const [label, setLabel] = useState(DEFAULT_ELEMENT_LABEL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    setBusy(true); setError("");
    const failure = await act({ action: "category.create", name: name.trim(), elementLabel: label.trim() || DEFAULT_ELEMENT_LABEL });
    setBusy(false);
    if (failure) setError(failure); else onCreated(name.trim());
  };
  return (
    <section className="catalog-panel">
      <header className="catalog-panel-header"><div><p className="eyebrow">NUEVA CATEGORÍA</p><h2 className="catalog-panel-title">Crear categoría</h2></div></header>
      <div className="new-category-form">
        <div className="requirement-field"><label htmlFor="new-category-name">Nombre</label><Input id="new-category-name" placeholder="Ej. Topografía" value={name} maxLength={80} disabled={busy} onChange={event => setName(event.target.value)} /></div>
        <div className="requirement-field"><label htmlFor="new-category-label">Nombre del campo de elemento</label><Input id="new-category-label" placeholder="Ej. Tipo de instrumento" value={label} maxLength={80} disabled={busy} onChange={event => setLabel(event.target.value)} /></div>
        <p className="select-card-note">El campo de elemento es el que se completa con sugerencias al pedir esta categoría (por ejemplo «Cargo» en Personas). Después podrás llenar su catálogo maestro y agregarle atributos.</p>
        {error && <p role="alert" className="requirement-error">{error}</p>}
        <div className="catalog-actions"><Button type="button" disabled={busy || !name.trim()} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}Crear categoría</Button></div>
      </div>
    </section>
  );
}

/** Creates an attribute with its options, optionally linked right away to the categories that will ask for it. */
function NewAttributeForm({ catalog, onCreated }: { catalog: Catalog; onCreated: () => void }) {
  const act = useCatalogAction();
  const [label, setLabel] = useState("");
  const [options, setOptions] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const parsed = uniqueValues(options.split(/[,\n]/)).slice(0, 30);
  const sorted = [...catalog.categories].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const toggle = (name: string, checked: boolean) => setCategories(current => checked ? [...new Set([...current, name])] : current.filter(entry => entry !== name));
  const create = async () => {
    setBusy(true); setError("");
    const failure = await act({ action: "field.create", label: label.trim(), options: parsed, categories });
    setBusy(false);
    if (failure) setError(failure); else onCreated();
  };
  return (
    <section className="catalog-panel">
      <header className="catalog-panel-header"><div><p className="eyebrow">NUEVO ATRIBUTO</p><h2 className="catalog-panel-title">Crear atributo</h2></div></header>
      <div className="new-category-form">
        <div className="requirement-field"><label htmlFor="new-attribute-name">Nombre</label><Input id="new-attribute-name" placeholder="Ej. Talla" value={label} maxLength={80} disabled={busy} onChange={event => setLabel(event.target.value)} /></div>
        <div className="requirement-field"><label htmlFor="new-attribute-options">Opciones, separadas por coma</label><Input id="new-attribute-options" placeholder="Ej. S, M, L, XL" value={options} maxLength={3000} disabled={busy} onChange={event => setOptions(event.target.value)} /></div>
        {parsed.length > 0 && <ul className="option-chips new-attribute-preview" aria-label="Opciones del atributo nuevo">{parsed.map(option => <li key={option} className="option-chip">{option}</li>)}</ul>}
        <fieldset className="attribute-categories">
          <legend>Categorías que lo usan <span className="select-card-note">(opcional)</span></legend>
          <div className="attribute-category-grid">
            {sorted.map(category => {
              const id = `new-attribute-${category.name}`.replace(/\s+/g, "-").toLowerCase();
              return <label key={category.name} htmlFor={id} className="filter-option"><Checkbox id={id} disabled={busy} checked={categories.includes(category.name)} onCheckedChange={checked => toggle(category.name, checked === true)} />{category.name}</label>;
            })}
          </div>
        </fieldset>
        <p className="select-card-note">Un atributo es una lista de opciones que se elige al pedir (por ejemplo «Marca» o «Unidad»). Si no eliges categorías queda en Atributos compartidos y puedes asociarlo después desde cada categoría.</p>
        {error && <p role="alert" className="requirement-error">{error}</p>}
        <div className="catalog-actions"><Button type="button" disabled={busy || !label.trim() || parsed.length === 0} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}Crear atributo</Button></div>
      </div>
    </section>
  );
}

function CategoryPanel({ catalog, masters, groups, name, onRenamed, onDeleted }: { catalog: Catalog; masters: Masters; groups: CatalogGroup[]; name: string; onRenamed: (name: string) => void; onDeleted: () => void }) {
  const act = useCatalogAction();
  const category = findCategory(catalog, name);
  const pending = pendingFor(catalog, groups, name);
  if (!category) {
    // A category someone proposed: nothing to manage until it is approved.
    return (
      <section className="catalog-panel">
        <header className="catalog-panel-header"><div><p className="eyebrow">CATEGORÍA PROPUESTA</p><h2 className="catalog-panel-title">{name}</h2></div></header>
        <p className="select-card-note">Esta categoría aún no existe en el catálogo. Apruébala (puedes corregir su nombre o unirla a una existente) para crear su catálogo maestro; luego podrás aprobar sus elementos.</p>
        {pending.length ? <PendingList groups={pending} catalog={catalog} /> : <p className="catalog-empty">No hay novedades pendientes para esta categoría.</p>}
      </section>
    );
  }
  const elements = mastersOf(masters, category.name);
  const label = category.elementLabel ?? DEFAULT_ELEMENT_LABEL;
  return (
    <section className="catalog-panel">
      <header className="catalog-panel-header">
        <div>
          <p className="eyebrow">CATEGORÍA</p>
          <h2 className="catalog-panel-title">
            <EditableText value={category.name} label="nombre de la categoría" onSave={async to => { const failure = await act({ action: "category.rename", name: category.name, to }); if (!failure) onRenamed(to); return failure; }}>
              <span>{category.name}</span>
            </EditableText>
          </h2>
          <p className="catalog-panel-meta">
            <span>Campo de elemento:</span>
            <EditableText value={label} label="nombre del campo de elemento" onSave={value => act({ action: "category.label", name: category.name, label: value })}><strong>{label}</strong></EditableText>
            {(category.aliases?.length ?? 0) > 0 && <span className="element-aliases">antes: {category.aliases!.join(", ")}</span>}
          </p>
        </div>
        <ConfirmDelete compact={false} label="Eliminar categoría" title={`¿Eliminar la categoría «${category.name}»?`}
          description={<>Dejará de ofrecerse en Nueva solicitud y se eliminará su catálogo maestro ({elements.length === 1 ? "1 elemento" : `${elements.length} elementos`}). Los atributos se conservan para otras categorías. Las solicitudes existentes no cambian.</>}
          onConfirm={async () => { const failure = await act({ action: "category.delete", name: category.name }); if (!failure) onDeleted(); return failure; }} />
      </header>
      <Tabs defaultValue={pending.length ? "pendientes" : "elementos"} className="catalog-tabs">
        <TabsList className="catalog-tab-list">
          <TabsTrigger value="pendientes">Por aprobar{pending.length > 0 ? <span className="tab-badge">{pending.length}</span> : <span className="tab-count">0</span>}</TabsTrigger>
          <TabsTrigger value="elementos">{label}<span className="tab-count">{elements.length}</span></TabsTrigger>
          <TabsTrigger value="atributos">Atributos<span className="tab-count">{category.fieldIds.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes">{pending.length ? <PendingList groups={pending} catalog={catalog} /> : <p className="catalog-empty">Nada pendiente en {category.name}.</p>}</TabsContent>
        <TabsContent value="elementos"><ElementsTab category={category.name} elementLabel={label} elements={elements} /></TabsContent>
        <TabsContent value="atributos"><SelectsTab catalog={catalog} category={category.name} /></TabsContent>
      </Tabs>
    </section>
  );
}

function CatalogPage() {
  const { catalog, masters, groups } = Route.useLoaderData();
  const { ver } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const show = (view: string) => navigate({ search: { ver: view } });
  const view = ver ?? (groups.length ? "pendientes" : `c:${catalog.categories[0]?.name ?? ""}`);
  const proposed = [...new Set(groups.filter(group => group.kind === "type").map(group => group.name))];
  const categories = [...catalog.categories].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const byCategory = [...new Set(groups.map(group => findCategory(catalog, group.category)?.name ?? group.category))];

  const navItem = (id: string, content: ReactNode) => (
    <li key={id}><button type="button" className={`catalog-nav-item${view === id ? " active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => show(id)}>{content}</button></li>
  );

  return (
    <AppShell trail={["Solicitudes", "Catálogo"]}>
      <div className="my-requests catalog-page">
        <p className="eyebrow">ADMINISTRADOR DE CONTRATO</p>
        <h1 className="page-heading">Catálogo de requerimientos</h1>
        <p className="page-description">Gestiona cada categoría: su catálogo maestro, sus atributos y lo que los solicitantes propusieron. Solo lo aprobado aparece en Nueva solicitud.</p>

        <div className="catalog-layout">
          <nav className="catalog-nav" aria-label="Categorías del catálogo">
            <ScrollArea type="auto" className="catalog-nav-scroll"><div className="catalog-nav-inner">
            <ul>
              {navItem("pendientes", <><Inbox aria-hidden="true" /><span className="catalog-nav-name">Por aprobar<small>Todas las categorías</small></span>{groups.length > 0 ? <span className="tab-badge">{groups.length}</span> : <span className="tab-count">0</span>}</>)}
            </ul>
            <p className="catalog-nav-heading">Categorías</p>
            <ul>
              {categories.map(category => {
                const pending = pendingFor(catalog, groups, category.name).length;
                return navItem(`c:${category.name}`, <><Layers aria-hidden="true" /><span className="catalog-nav-name">{category.name}<small>{category.elementLabel ?? DEFAULT_ELEMENT_LABEL} · {mastersOf(masters, category.name).length}</small></span>{pending > 0 && <span className="tab-badge">{pending}</span>}</>);
              })}
              {proposed.map(name => navItem(`c:${name}`, <><Sparkles aria-hidden="true" /><span className="catalog-nav-name">{name}<small>Categoría propuesta</small></span><span className="tab-badge">{pendingFor(catalog, groups, name).length}</span></>))}
              {navItem("nueva", <><FolderPlus aria-hidden="true" /><span className="catalog-nav-name">Nueva categoría</span></>)}
            </ul>
            <p className="catalog-nav-heading">Atributos</p>
            <ul>
              {navItem("atributos", <><ListChecks aria-hidden="true" /><span className="catalog-nav-name">Atributos compartidos<small>Usados por varias categorías</small></span><span className="tab-count">{catalog.fields.length}</span></>)}
              {navItem("nuevo-atributo", <><ListPlus aria-hidden="true" /><span className="catalog-nav-name">Nuevo atributo</span></>)}
            </ul>
            </div></ScrollArea>
          </nav>

          <div className="catalog-main">
            {view === "pendientes" && (
              <section className="catalog-panel">
                <header className="catalog-panel-header"><div><p className="eyebrow">POR APROBAR</p><h2 className="catalog-panel-title">Novedades de las solicitudes</h2></div></header>
                {groups.length === 0 && <p className="catalog-empty">No hay novedades pendientes. Todo lo que usan las solicitudes ya está en el catálogo o fue decidido.</p>}
                {byCategory.map(name => (
                  <div key={name} className="pending-category">
                    <div className="pending-category-heading"><h3>{name}</h3><Button type="button" variant="link" size="sm" onClick={() => show(`c:${name}`)}>Ver categoría</Button></div>
                    <PendingList groups={groups.filter(group => same(findCategory(catalog, group.category)?.name ?? group.category, name))} catalog={catalog} />
                  </div>
                ))}
              </section>
            )}
            {view === "nueva" && <NewCategoryForm onCreated={name => show(`c:${name}`)} />}
            {view === "nuevo-atributo" && <NewAttributeForm catalog={catalog} onCreated={() => show("atributos")} />}
            {view === "atributos" && (
              <section className="catalog-panel">
                <header className="catalog-panel-header">
                  <div><p className="eyebrow">ATRIBUTOS COMPARTIDOS</p><h2 className="catalog-panel-title">Todos los atributos</h2></div>
                  <Button type="button" size="sm" onClick={() => show("nuevo-atributo")}><Plus />Nuevo atributo</Button>
                </header>
                <p className="select-card-note">Un mismo atributo puede usarse en varias categorías: renombrarlo o cambiar sus opciones afecta a todas. Para asociarlo a una categoría, entra a esa categoría.</p>
                <div className="select-grid">{[...catalog.fields].sort((a, b) => a.label.localeCompare(b.label, "es")).map(field => <SelectCard key={field.id} field={field} catalog={catalog} />)}</div>
              </section>
            )}
            {view.startsWith("c:") && <CategoryPanel key={view} catalog={catalog} masters={masters} groups={groups} name={view.slice(2)} onRenamed={name => show(`c:${name}`)} onDeleted={() => show("pendientes")} />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
