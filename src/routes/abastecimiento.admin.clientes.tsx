import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Briefcase, Loader2, Pencil, Plus, Power, PowerOff, Sparkles } from "lucide-react";
import { ActiveBadge, FormDialog, LoadError, MutationError, ProcurementHeader, ProcurementPage, useCan } from "@/components/abastecimiento/admin-ui";
import { Actions, Badge, Callout, DataList, DataListSkeleton, FilterBar, FilterField, FormRow, IconAction, Optional, Page, RutInput, SearchInput, Stack, rutProblem, type DataColumn } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { normalizeRut } from "@/lib/access";
import type { Client, DealSummary } from "@/lib/abastecimiento/data";
import { clientDealTotals, dealStatusLabel } from "@/lib/abastecimiento/deal";
import { formatAmount } from "@/lib/abastecimiento/format";
import { useClients, useCreateClient, useDeals, useSuggestClientSigla, useUpdateClient } from "@/lib/abastecimiento/hooks";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const to = "/abastecimiento/admin/clientes";
const title = procurementViews.find(view => view.to === to)!.title;

export const Route = createFileRoute("/abastecimiento/admin/clientes")({
  component: () => <ProcurementPage to={to}><ClientsPage /></ProcurementPage>,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** New client or edit one: name, sigla (suggested from the name when left blank) and an optional RUT. */
function ClientDialog({ client, open, onOpenChange }: { client: Client | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateClient();
  const update = useUpdateClient();
  const suggest = useSuggestClientSigla();
  const [name, setName] = useState("");
  const [sigla, setSigla] = useState("");
  const [taxId, setTaxId] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(client?.name ?? ""); setSigla(client?.sigla ?? ""); setTaxId(client?.taxId ?? ""); create.reset(); update.reset();
  }, [open, client]); // eslint-disable-line react-hooks/exhaustive-deps
  const rut = rutProblem(taxId);
  const mutation = client ? update : create;
  const rutValue = taxId.trim() ? (normalizeRut(taxId) ?? taxId) : "";
  const save = () => {
    const done = { onSuccess: () => onOpenChange(false) };
    const body = { name: name.trim(), ...(sigla.trim() && { sigla: sigla.trim() }) };
    // Editing, an emptied RUT is sent blank so it is cleared; creating, it is left out.
    if (client) update.mutate({ id: client.id, ...body, taxId: rutValue }, done);
    else create.mutate({ ...body, ...(rutValue && { taxId: rutValue }) }, done);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={client ? `Editar ${client.name}` : "Nuevo cliente"}
      description="La sigla arma el código de cada proyecto del cliente (MLA260301)."
      busy={mutation.isPending} error={mutation.error} errorFallback={client ? "No se pudo guardar el cliente." : "No se pudo crear el cliente."}
      submitLabel={client ? "Guardar cambios" : "Crear cliente"} busyLabel={client ? "Guardando…" : "Creando…"} canSubmit={name.trim() !== "" && !rut} onSubmit={save}>
      <Field>
        <FieldLabel htmlFor="client-name">Nombre</FieldLabel>
        <Input id="client-name" maxLength={150} value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <FormRow>
        <Field>
          <FieldLabel htmlFor="client-sigla">Sigla</FieldLabel>
          <div className="flex gap-2">
            <Input id="client-sigla" maxLength={10} className="uppercase" placeholder="Se genera si la dejas en blanco" value={sigla} onChange={event => setSigla(event.target.value.toUpperCase())} />
            <Button type="button" variant="outline" disabled={!name.trim() || suggest.isPending} onClick={() => suggest.mutate(name.trim(), { onSuccess: setSigla })}>
              {suggest.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}Sugerir
            </Button>
          </div>
          <FieldDescription>De 2 a 10 letras o números.</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(rut)}>
          <FieldLabel htmlFor="client-tax-id">RUT <Optional /></FieldLabel>
          <RutInput id="client-tax-id" placeholder="76.123.456-7" value={taxId} onValueChange={setTaxId} />
          <FieldError>{rut}</FieldError>
        </Field>
      </FormRow>
    </FormDialog>
  );
}

/** A client's deals, with their value and projects. Each deal is edited in Negocios. */
function ClientDealsDialog({ client, deals, canCreateDeal, onOpenChange }: { client: Client | null; deals: DealSummary[]; canCreateDeal: boolean; onOpenChange: (open: boolean) => void }) {
  const totals = clientDealTotals(deals);
  return (
    <Dialog open={client !== null} onOpenChange={onOpenChange}>
      <DialogContent className="access-dialog">
        <DialogBody>
          <DialogHeader>
            <DialogTitle>Negocios de {client?.name}</DialogTitle>
            <DialogDescription>
              {deals.length === 0 ? "Este cliente todavía no tiene negocios." : `${plural(totals.deals, "negocio", "negocios")} · ${plural(totals.projects, "proyecto", "proyectos")} · ${formatAmount(totals.value)}`}
            </DialogDescription>
          </DialogHeader>
          <Stack>
            {deals.length > 0 && (
              <ul className="ab-deals">
                {deals.map(deal => (
                  <li key={deal.id}>
                    <span><strong>{deal.code}</strong> · {deal.name}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {formatAmount(deal.currentValue)} · {plural(deal.projectCount, "proyecto", "proyectos")}
                      <Badge tone={deal.status === "CLOSED" ? "neutral" : "success"}>{dealStatusLabel(deal.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="outline"><Link to="/abastecimiento/negocios"><Briefcase />Ir a Negocios</Link></Button>
              {canCreateDeal && <Button asChild variant="outline"><Link to="/abastecimiento/negocios"><Plus />Nuevo negocio</Link></Button>}
            </div>
          </Stack>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * «Clientes» (source: /admin/clients): the client catalog, created, edited and deactivated here, with each client's
 * deals at hand. Deals themselves are edited in Negocios (phase 3).
 */
function ClientsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [term, setTerm] = useState("");
  const { data: clients, isLoading, error } = useClients(showInactive);
  const canWrite = useCan("clients:write");
  const canCreate = useCan("clients:create");
  const canSeeDeals = useCan("sales:read");
  const canCreateDeal = useCan("sales:create");
  const { data: deals } = useDeals(canSeeDeals);
  const update = useUpdateClient();
  const [editing, setEditing] = useState<Client | null | undefined>(undefined);
  const [showingDeals, setShowingDeals] = useState<Client | null>(null);

  const dealsOf = (client: Client) => (deals ?? []).filter(deal => deal.clientId === client.id);
  const rows = useMemo(() => {
    const search = fold(term.trim());
    return (clients ?? []).filter(client => !search || fold([client.name, client.sigla, client.taxId].filter(Boolean).join(" ")).includes(search));
  }, [clients, term]);

  const columns: DataColumn<Client>[] = [
    { key: "name", header: "Nombre", card: "title", cell: client => <strong>{client.name}</strong> },
    { key: "sigla", header: "Sigla", cell: client => client.sigla ?? "—" },
    { key: "rut", header: "RUT", cell: client => <span className="tabular-nums">{client.taxId ?? "—"}</span> },
    ...(canSeeDeals ? [{
      key: "deals", header: "Negocios", cell: (client: Client) => {
        const totals = clientDealTotals(dealsOf(client));
        return (
          <button type="button" className="ds-link text-left" onClick={() => setShowingDeals(client)}>
            {totals.deals === 0 ? "Sin negocios" : `${plural(totals.deals, "negocio", "negocios")} · ${formatAmount(totals.value)}`}
          </button>
        );
      },
    }] : []),
    { key: "status", header: "Estado", cell: client => <ActiveBadge active={client.active} /> },
  ];

  const actions = (client: Client) => (
    <Actions>
      <IconAction label={`Editar ${client.name}`} onClick={() => setEditing(client)}><Pencil /></IconAction>
      <IconAction label={client.active ? `Desactivar ${client.name}` : `Activar ${client.name}`} danger={client.active} disabled={update.isPending} onClick={() => update.mutate({ id: client.id, active: !client.active })}>
        {client.active ? <PowerOff /> : <Power />}
      </IconAction>
    </Actions>
  );

  return (
    <Page>
      <ProcurementHeader to={to} actions={canCreate && <Button onClick={() => setEditing(null)}><Plus />Nuevo cliente</Button>} />
      <Stack>
        <FilterBar label="Búsqueda" end={
          <label htmlFor="clients-inactive" className="flex items-center gap-2 text-sm">
            <Checkbox id="clients-inactive" checked={showInactive} onCheckedChange={checked => setShowInactive(checked === true)} />
            Mostrar inactivos
          </label>
        }>
          <FilterField id="clients-search" label="Buscar" grow>
            <SearchInput id="clients-search" placeholder="Nombre, sigla o RUT" value={term} onChange={event => setTerm(event.target.value)} />
          </FilterField>
        </FilterBar>
        {!canWrite && <Callout variant="info">Puedes crear clientes, pero no editarlos ni desactivarlos.</Callout>}
        <MutationError error={update.error} fallback="No se pudo actualizar el cliente." />
        {isLoading && <DataListSkeleton label="Clientes" columns={5} />}
        {error && <LoadError what="los clientes" />}
        {clients && (
          <DataList label="Clientes" rows={rows} columns={columns} rowKey={client => client.id} {...(canWrite && { actions })}
            empty={clients.length === 0 ? "Todavía no hay clientes registrados." : "Ningún cliente coincide con la búsqueda."} />
        )}
      </Stack>
      <ClientDialog client={editing ?? null} open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} />
      <ClientDealsDialog client={showingDeals} deals={showingDeals ? dealsOf(showingDeals) : []} canCreateDeal={canCreateDeal} onOpenChange={open => { if (!open) setShowingDeals(null); }} />
    </Page>
  );
}
