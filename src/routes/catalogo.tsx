import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck, Inbox } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NoveltyEditor, itemTitle } from "@/components/requests/classification-review";
import type { CatalogGroup, ItemEdit } from "@/lib/catalog";
import { decideCatalogItems, getCatalogReview } from "@/lib/requests.functions";

export const Route = createFileRoute("/catalogo")({
  loader: () => getCatalogReview(),
  component: CatalogPage,
  head: () => ({ meta: [
    { title: "Catálogo | Ecosistema X" },
    { name: "description", content: "Tipos, selects y opciones del catálogo de requerimientos, y las novedades que esperan aprobación del Administrador de Contrato." },
    { property: "og:title", content: "Catálogo | Ecosistema X" },
    { property: "og:description", content: "Catálogo de requerimientos y novedades por aprobar." },
  ] }),
});

const kindTitle = { type: "Tipos nuevos", field: "Selects nuevos", link: "Selects por asociar a un tipo", option: "Opciones nuevas en selects existentes" } as const;

function GroupCard({ group, onDecide, catalog }: { group: CatalogGroup; catalog: Parameters<typeof NoveltyEditor>[0]["catalog"]; onDecide: (group: CatalogGroup) => (status: "aprobada" | "rechazada", edit: ItemEdit) => Promise<string | null> }) {
  return (
    <li className="catalog-part">
      <div className="catalog-part-heading">
        <p className="catalog-part-summary">{itemTitle(group)}</p>
        <span className="novelty-count">{group.requests.length === 1 ? "1 solicitud" : `${group.requests.length} solicitudes`}</span>
      </div>
      <p className="catalog-options">Propuesto en {group.requests.map(r => `${r.code} (${r.requester})`).join(", ")}</p>
      <NoveltyEditor key={`${group.id}-${catalog.fields.length}-${catalog.categories.length}`} item={{ ...group, options: group.kind === "field" ? group.options : undefined }} catalog={catalog} onDecide={onDecide(group)} />
    </li>
  );
}

function CatalogPage() {
  const { catalog, groups } = Route.useLoaderData();
  const router = useRouter();
  const decide = useServerFn(decideCatalogItems);
  const onDecide = (group: CatalogGroup) => async (status: "aprobada" | "rechazada", edit: ItemEdit) => {
    const response = await decide({ data: { targets: group.targets, status, edit } });
    if (response.error) return response.error;
    await router.invalidate();
    return null;
  };
  const kinds = (["type", "field", "link", "option"] as const).filter(kind => groups.some(group => group.kind === kind));

  return (
    <AppShell trail={["Solicitudes", "Catálogo"]}>
      <div className="my-requests">
        <p className="eyebrow">ADMINISTRADOR DE CONTRATO</p>
        <h1 className="page-heading">Catálogo de requerimientos</h1>
        <p className="page-description">Lo que los solicitantes crean (tipos, selects y opciones) queda pendiente hasta que lo apruebes aquí o en el detalle de cada solicitud. Solo lo aprobado aparece en Nueva solicitud.</p>

        <section className="catalog-section" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="catalog-section-title"><Inbox aria-hidden="true" />Novedades por revisar <span className="novelty-count">{groups.length}</span></h2>
          {groups.length === 0 && <p className="catalog-empty">No hay novedades pendientes. Todo lo que usan las solicitudes ya está en el catálogo o fue decidido.</p>}
          {kinds.map(kind => (
            <div key={kind} className="catalog-kind">
              <h3>{kindTitle[kind]}</h3>
              <ul className="novelty-list">{groups.filter(group => group.kind === kind).map(group => <GroupCard key={group.id} group={group} catalog={catalog} onDecide={onDecide} />)}</ul>
            </div>
          ))}
        </section>

        <section className="catalog-section" aria-labelledby="current-heading">
          <h2 id="current-heading" className="catalog-section-title"><BookOpenCheck aria-hidden="true" />Catálogo vigente</h2>
          <div className="catalog-grid">
            <div className="catalog-card">
              <h3>Tipos y sus selects</h3>
              <ul className="catalog-items">{catalog.categories.map(category => (
                <li key={category.name}><strong>{category.name}</strong><span className="catalog-options">{category.fieldIds.map(id => catalog.fields.find(field => field.id === id)?.label).filter(Boolean).join(", ") || "Sin selects"}</span></li>
              ))}</ul>
            </div>
            <div className="catalog-card">
              <h3>Selects y sus opciones</h3>
              <ul className="catalog-items">{catalog.fields.map(field => (
                <li key={field.id}><strong>{field.label}</strong><span className="catalog-options">{field.options.join(", ")}</span></li>
              ))}</ul>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
