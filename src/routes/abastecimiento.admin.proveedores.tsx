import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Download, Loader2, Pencil, Plus, Power, PowerOff, Tags as TagsIcon, Trash2 } from "lucide-react";
import { ActiveBadge, FormDialog, MutationError, LoadError, ProcurementHeader, ProcurementPage, useCan } from "@/components/abastecimiento/admin-ui";
import { CategoryPicker } from "@/components/abastecimiento/category-picker";
import { VendorForm } from "@/components/abastecimiento/vendor-form";
import { VendorMetricsPanel } from "@/components/abastecimiento/vendor-metrics";
import { Actions, Badge, Callout, DataList, DataListSkeleton, FilterBar, FilterField, IconAction, Page, Pagination, SearchInput, SegmentedFilter, Stack, Tag, Tags, type DataColumn } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeRut } from "@/lib/access";
import type { Vendor, VendorCategory } from "@/lib/abastecimiento/data";
import {
  useCreateVendor, useCreateVendorCategory, useDeleteVendorCategory, useExportVendors, useRenameVendorCategory, useUpdateVendor, useVendorCategories, useVendors,
} from "@/lib/abastecimiento/hooks";
import { procurementViews } from "@/lib/abastecimiento/navigation";
import {
  categoryParam, chosenCategories, creditShort, emptyVendorForm, idsOfNames, mainContact, missingLabels, parseCategoryParam, vendorFormBody, vendorFormProblems, vendorToForm,
  type VendorFormValues,
} from "@/lib/abastecimiento/vendors";

const to = "/abastecimiento/admin/proveedores";
const title = procurementViews.find(view => view.to === to)!.title;
const SIZES = [10, 25, 50] as const;

type VendorsSearch = { buscar?: string | undefined; inactivos?: true | undefined; cat?: string | undefined; vista?: "metricas" | undefined; pagina?: number | undefined; filas?: number | undefined };

export const Route = createFileRoute("/abastecimiento/admin/proveedores")({
  // The filters, the view and the page live in the URL (as in the source), so a filtered list can be shared.
  validateSearch: (search: Record<string, unknown>): VendorsSearch => {
    const page = Number(search["pagina"]);
    const size = Number(search["filas"]);
    return {
      ...(typeof search["buscar"] === "string" && search["buscar"] && { buscar: search["buscar"].slice(0, 100) }),
      ...((search["inactivos"] === true || search["inactivos"] === "1" || search["inactivos"] === 1) && { inactivos: true as const }),
      ...(typeof search["cat"] === "string" && search["cat"] && { cat: search["cat"] }),
      ...(search["vista"] === "metricas" && { vista: "metricas" as const }),
      ...(Number.isInteger(page) && page > 1 && { pagina: page }),
      ...(SIZES.includes(size as 10) && size !== 10 && { filas: size }),
    };
  },
  component: () => <ProcurementPage to={to}><VendorsPage /></ProcurementPage>,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});

/** New vendor or edit one: the whole form, with what it still lacks under it once someone tries to save. */
function VendorDialog({ vendor, categories, open, onOpenChange }: { vendor: Vendor | null; categories: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const [values, setValues] = useState<VendorFormValues>(emptyVendorForm());
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setValues(vendor ? vendorToForm(vendor) : emptyVendorForm()); setTried(false); create.reset(); update.reset();
  }, [open, vendor]); // eslint-disable-line react-hooks/exhaustive-deps
  const problems = vendorFormProblems(values);
  const mutation = vendor ? update : create;
  // RUTs are stored without dots ("12345678-5"), the way the API keeps them.
  const normalized = { ...values, taxId: normalizeRut(values.taxId) ?? values.taxId, accounts: values.accounts.map(account => ({ ...account, recipientTaxId: normalizeRut(account.recipientTaxId) ?? account.recipientTaxId })) };
  const save = () => {
    setTried(true);
    if (problems.length > 0) return;
    const done = { onSuccess: () => onOpenChange(false) };
    if (vendor) update.mutate({ id: vendor.id, ...vendorFormBody(normalized, "update") }, done);
    else create.mutate(vendorFormBody(normalized, "create"), done);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} wide title={vendor ? `Editar ${vendor.name}` : "Nuevo proveedor"}
      description={vendor ? "Los cambios se ven en las órdenes nuevas; las ya emitidas conservan los datos con que se hicieron." : "Un proveedor se registra completo una vez y se elige en cada orden de compra."}
      busy={mutation.isPending} error={mutation.error} errorFallback={vendor ? "No se pudo guardar el proveedor." : "No se pudo crear el proveedor."}
      submitLabel={vendor ? "Guardar cambios" : "Crear proveedor"} busyLabel={vendor ? "Guardando…" : "Creando…"} onSubmit={save}>
      <VendorForm idPrefix={vendor ? `vendor-${vendor.id}` : "vendor-new"} values={values} onChange={setValues} categories={categories} />
      {tried && problems.length > 0 && (
        <Callout variant="warning" title="Falta completar">
          <ul className="list-disc pl-5">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>
        </Callout>
      )}
    </FormDialog>
  );
}

/** One category of the pool: its name (editable), how many vendors have it, and removing it when nobody does. */
function CategoryRow({ category, canWrite }: { category: VendorCategory; canWrite: boolean }) {
  const rename = useRenameVendorCategory();
  const remove = useDeleteVendorCategory();
  const [name, setName] = useState(category.name);
  const used = category.vendorCount ?? 0;
  const changed = name.trim() !== "" && name.trim() !== category.name;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={`Nombre de la categoría ${category.name}`} className="min-w-0 flex-1 basis-48" maxLength={100} value={name} disabled={!canWrite} onChange={event => setName(event.target.value)} />
        <span className="ds-meta w-24">{used === 1 ? "1 proveedor" : `${used} proveedores`}</span>
        {canWrite && <>
          <Button type="button" variant="outline" size="sm" disabled={!changed || rename.isPending} onClick={() => rename.mutate({ id: category.id, name: name.trim() })}>Renombrar</Button>
          <IconAction label={`Quitar ${category.name}`} danger disabled={used > 0 || remove.isPending} reason={used > 0 ? "Quítala primero de los proveedores que la tienen." : null} onClick={() => remove.mutate(category.id)}><Trash2 /></IconAction>
        </>}
      </div>
      <MutationError error={rename.error ?? remove.error} fallback="No se pudo cambiar la categoría." />
    </li>
  );
}

/** The company's pool of vendor categories: what exists and how much it is used, a new one, renames and removals. */
function CategoryManager({ open, onOpenChange, pool, canCreate, canWrite }: { open: boolean; onOpenChange: (open: boolean) => void; pool: VendorCategory[]; canCreate: boolean; canWrite: boolean }) {
  const create = useCreateVendorCategory();
  const [draft, setDraft] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="access-dialog">
        <DialogBody>
          <DialogHeader>
            <DialogTitle>Categorías de proveedores</DialogTitle>
            <DialogDescription>Cada proveedor elige las suyas de esta lista, las que quiera. Una nueva también se puede escribir al llenar el proveedor.</DialogDescription>
          </DialogHeader>
          <Stack>
            {pool.length === 0 && <p className="ds-meta">Todavía no hay categorías.</p>}
            <ul className="flex flex-col gap-3">{pool.map(category => <CategoryRow key={`${category.id}-${category.name}`} category={category} canWrite={canWrite} />)}</ul>
            {canCreate && (
              <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (draft.trim()) create.mutate(draft.trim(), { onSuccess: () => setDraft("") }); }}>
                <Input aria-label="Nueva categoría" placeholder="Nueva categoría…" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} />
                <Button type="submit" variant="outline" disabled={draft.trim() === "" || create.isPending}>{create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}Agregar</Button>
              </form>
            )}
            <MutationError error={create.error} fallback="No se pudo agregar la categoría." />
          </Stack>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

const columns: DataColumn<Vendor>[] = [
  { key: "name", header: "Proveedor", card: "title", cell: vendor => {
    const missing = missingLabels(vendor);
    return (
      <span className="flex flex-col gap-0.5">
        <strong>{vendor.name}</strong>
        {(vendor.legalName || vendor.businessActivity) && <span className="ds-meta">{[vendor.legalName, vendor.businessActivity].filter(Boolean).join(" · ")}</span>}
        {missing.length > 0 && <span><Badge tone="warning" title={`Falta: ${missing.join(", ")}`}>Datos incompletos</Badge></span>}
      </span>
    );
  } },
  { key: "rut", header: "RUT", cell: vendor => <span className="whitespace-nowrap tabular-nums">{vendor.taxId ?? "—"}</span> },
  { key: "categories", header: "Categorías", cell: vendor => ((vendor.categories ?? []).length === 0 ? "—" : <Tags className="ab-tags-wrap">{(vendor.categories ?? []).map(category => <Tag key={category.id}>{category.name}</Tag>)}</Tags>) },
  { key: "credit", header: "Pago", cell: vendor => creditShort(vendor.creditDays) },
  { key: "contact", header: "Contacto principal", cell: vendor => {
    const contact = mainContact(vendor);
    const others = (vendor.contacts?.length ?? 0) - 1;
    if (!contact) return "—";
    return (
      <span className="flex flex-col">
        <span>{contact.name}{others > 0 && <span className="ds-meta"> · +{others}</span>}</span>
        <span className="ds-meta">{[contact.phone, contact.email].filter(Boolean).join(" · ") || "—"}</span>
      </span>
    );
  } },
  { key: "status", header: "Estado", cell: vendor => <ActiveBadge active={vendor.active} /> },
];

/**
 * «Proveedores» (source: /admin/vendors): the vendor catalog one page at a time, with search, categories and the
 * inactive ones in the URL; each vendor complete (contacts, payment accounts, categories) in a modal; the pool of
 * categories; the metrics; and the export of what the filters leave in.
 */
function VendorsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (change: Partial<VendorsSearch>, keepPage = false) =>
    void navigate({ search: prev => { const next = { ...prev, ...change }; if (!keepPage) delete next.pagina; return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as VendorsSearch; }, replace: true });

  const { data: pool } = useVendorCategories();
  const urlCategoryIds = parseCategoryParam(search.cat ?? "");
  const chosen = pool ? chosenCategories(urlCategoryIds, pool) : urlCategoryIds.map(id => ({ id, name: "" }));
  const categoryIds = chosen.map(category => category.id);
  const categoryLabel = chosen.map(category => category.name).filter(Boolean).join(", ");
  const pageSize = search.filas ?? 10;
  const { data: page, isLoading, error, isPlaceholderData } = useVendors({
    ...(search.buscar && { search: search.buscar }), ...(search.inactivos && { includeInactive: true }), ...(categoryIds.length > 0 && { categoryIds }), page: search.pagina ?? 1, pageSize,
  });

  // Typing waits 300 ms before it filters, as the list would query the API.
  const [term, setTerm] = useState(search.buscar ?? "");
  useEffect(() => {
    const timer = window.setTimeout(() => { if ((search.buscar ?? "") !== term.trim()) setSearch({ buscar: term.trim() || undefined }); }, 300);
    return () => window.clearTimeout(timer);
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  // A link or a refresh can land on a page that no longer exists: step back to the last.
  useEffect(() => {
    if (page && page.total > 0 && page.items.length === 0 && page.page > 1) setSearch({ pagina: Math.max(1, Math.ceil(page.total / pageSize)) }, true);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const canCreate = useCan("vendors:create");
  const canWrite = useCan("vendors:write");
  const update = useUpdateVendor();
  const exportVendors = useExportVendors();
  const [editing, setEditing] = useState<Vendor | null | undefined>(undefined);
  const [managing, setManaging] = useState(false);
  const view = search.vista === "metricas" ? "metrics" : "list";
  const filtered = Boolean(search.buscar || categoryIds.length);

  const download = () => exportVendors.mutate({ ...(search.buscar && { search: search.buscar }), ...(search.inactivos && { includeInactive: true }), ...(categoryIds.length > 0 && { categoryIds }) }, {
    onSuccess: url => {
      const link = document.createElement("a");
      link.href = url; link.download = "proveedores.csv";
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    },
  });

  const actions = (vendor: Vendor) => (
    <Actions>
      <IconAction label={`Editar ${vendor.name}`} onClick={() => setEditing(vendor)}><Pencil /></IconAction>
      <IconAction label={vendor.active ? `Desactivar ${vendor.name}` : `Activar ${vendor.name}`} danger={vendor.active} disabled={update.isPending} onClick={() => update.mutate({ id: vendor.id, active: !vendor.active })}>
        {vendor.active ? <PowerOff /> : <Power />}
      </IconAction>
    </Actions>
  );

  return (
    <Page>
      <ProcurementHeader to={to} actions={<>
        <Button variant="outline" onClick={() => setManaging(true)}><TagsIcon />Categorías</Button>
        <Button variant="outline" disabled={exportVendors.isPending} onClick={download}>{exportVendors.isPending ? <Loader2 className="animate-spin" /> : <Download />}Exportar</Button>
        {canCreate && <Button onClick={() => setEditing(null)}><Plus />Nuevo proveedor</Button>}
      </>} />
      <Stack>
        <FilterBar label="Filtros" end={
          <label htmlFor="vendors-inactive" className="flex items-center gap-2 text-sm">
            <Checkbox id="vendors-inactive" checked={Boolean(search.inactivos)} onCheckedChange={checked => setSearch({ inactivos: checked === true ? true : undefined })} />
            Mostrar inactivos
          </label>
        }>
          <FilterField id="vendors-search" label="Buscar" grow>
            <SearchInput id="vendors-search" placeholder="Nombre, RUT, categoría o giro" maxLength={100} value={term} onChange={event => setTerm(event.target.value)} />
          </FilterField>
          <FilterField id="vendors-categories" label="Categorías">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="vendors-categories" variant="outline" className="w-full justify-between font-normal">
                  {categoryIds.length === 0 ? "Todas las categorías" : categoryIds.length === 1 ? (categoryLabel || "1 categoría") : `${categoryIds.length} categorías`}
                  <ChevronDown aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(92vw,360px)]">
                <CategoryPicker idPrefix="vendor-filter" value={chosen.map(category => category.name).filter(Boolean)} pool={(pool ?? []).map(category => category.name)} allowNew={false}
                  emptyText="Ninguna: se muestran todos los proveedores." onChange={names => setSearch({ cat: categoryParam(idsOfNames(names, pool ?? [])) })} />
              </PopoverContent>
            </Popover>
          </FilterField>
        </FilterBar>

        <SegmentedFilter label="Vista" value={view} onChange={next => setSearch({ vista: next === "metrics" ? "metricas" : undefined }, true)}
          options={[{ value: "list", label: "Lista", count: page?.total }, { value: "metrics", label: "Métricas" }]} />

        {!canCreate && <Callout variant="info">Puedes consultar los proveedores, pero no crearlos.</Callout>}
        <MutationError error={update.error} fallback="No se pudo actualizar el proveedor." />
        <MutationError error={exportVendors.error} fallback="No se pudo exportar la lista." />

        {view === "metrics" ? (
          <VendorMetricsPanel categoryIds={categoryIds} categoryLabel={categoryLabel} includeInactive={Boolean(search.inactivos)} />
        ) : (
          <>
            {isLoading && <DataListSkeleton label="Proveedores" columns={6} />}
            {error && <LoadError what="los proveedores" />}
            {page && (
              <DataList label="Proveedores" rows={page.items} columns={columns} rowKey={vendor => vendor.id} {...(canWrite && { actions })} collapseAt="lg"
                className={isPlaceholderData ? "opacity-60 transition-opacity" : ""}
                empty={filtered ? "Ningún proveedor coincide con la búsqueda." : "Todavía no hay proveedores registrados."}
                footer={<Pagination page={page.page} pageSize={pageSize} totalCount={page.total} sizes={SIZES} onPage={next => setSearch({ pagina: next > 1 ? next : undefined }, true)} onPageSize={size => setSearch({ filas: size !== 10 ? size : undefined })} />} />
            )}
          </>
        )}
      </Stack>
      <VendorDialog vendor={editing ?? null} categories={(pool ?? []).map(category => category.name)} open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} />
      <CategoryManager open={managing} onOpenChange={setManaging} pool={pool ?? []} canCreate={canCreate} canWrite={canWrite} />
    </Page>
  );
}
