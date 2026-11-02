import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Power, PowerOff } from "lucide-react";
import { ActiveBadge, FormDialog, LoadError, MutationError, ProcurementHeader, ProcurementPage, useCan } from "@/components/abastecimiento/admin-ui";
import { Actions, Callout, DataList, DataListSkeleton, IconAction, Optional, Page, Stack, type DataColumn } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BusinessUnit } from "@/lib/abastecimiento/data";
import { useBusinessUnits, useCreateBusinessUnit, useUpdateBusinessUnit } from "@/lib/abastecimiento/hooks";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const to = "/abastecimiento/admin/unidades";
const title = procurementViews.find(view => view.to === to)!.title;

export const Route = createFileRoute("/abastecimiento/admin/unidades")({
  component: () => <ProcurementPage to={to}><BusinessUnitsPage /></ProcurementPage>,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});

const columns: DataColumn<BusinessUnit>[] = [
  { key: "name", header: "Nombre", card: "title", cell: unit => <strong>{unit.name}</strong> },
  { key: "description", header: "Descripción", card: "title", cell: unit => <span className="text-muted-foreground">{unit.description ?? "Sin descripción"}</span> },
  { key: "status", header: "Estado", cell: unit => <ActiveBadge active={unit.active} feminine /> },
];

/** New unit or edit one: its name and an optional description. */
function UnitDialog({ unit, open, onOpenChange }: { unit: BusinessUnit | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateBusinessUnit();
  const update = useUpdateBusinessUnit();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(unit?.name ?? ""); setDescription(unit?.description ?? ""); create.reset(); update.reset();
  }, [open, unit]); // eslint-disable-line react-hooks/exhaustive-deps
  const mutation = unit ? update : create;
  const save = () => {
    const done = { onSuccess: () => onOpenChange(false) };
    if (unit) update.mutate({ id: unit.id, name: name.trim(), description: description.trim() || null }, done);
    else create.mutate({ name: name.trim(), description: description.trim() || undefined }, done);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={unit ? `Editar ${unit.name}` : "Nueva unidad de negocio"}
      description={unit ? "El nombre nuevo se ve en todos los proyectos que la tienen." : "Agrupa proyectos; se elige al crear un proyecto cuando hay más de una."}
      busy={mutation.isPending} error={mutation.error} errorFallback={unit ? "No se pudo guardar la unidad." : "No se pudo crear la unidad."}
      submitLabel={unit ? "Guardar cambios" : "Crear unidad"} busyLabel={unit ? "Guardando…" : "Creando…"} canSubmit={name.trim() !== ""} onSubmit={save}>
      <Field>
        <FieldLabel htmlFor="bu-name">Nombre</FieldLabel>
        <Input id="bu-name" maxLength={100} placeholder="Ej. Comercial, Ejecución, Abastecimiento" value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="bu-description">Descripción <Optional /></FieldLabel>
        <Input id="bu-description" maxLength={250} value={description} onChange={event => setDescription(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

/**
 * «Unidades de negocio» (source: /admin/business-units): the corporate units a project can belong to. They are
 * renamed and deactivated, never deleted: the projects that have one keep it.
 */
function BusinessUnitsPage() {
  const { data: units, isLoading, error } = useBusinessUnits(true);
  const update = useUpdateBusinessUnit();
  const canManage = useCan("business-units:manage");
  const [editing, setEditing] = useState<BusinessUnit | null | undefined>(undefined);

  const actions = (unit: BusinessUnit) => (
    <Actions>
      <IconAction label={`Editar ${unit.name}`} onClick={() => setEditing(unit)}><Pencil /></IconAction>
      <IconAction label={unit.active ? `Desactivar ${unit.name}` : `Activar ${unit.name}`} danger={unit.active} disabled={update.isPending} onClick={() => update.mutate({ id: unit.id, active: !unit.active })}>
        {unit.active ? <PowerOff /> : <Power />}
      </IconAction>
    </Actions>
  );

  return (
    <Page>
      <ProcurementHeader to={to} actions={canManage && <Button onClick={() => setEditing(null)}><Plus />Nueva unidad</Button>} />
      <Stack>
        <Callout variant="note">
          La unidad es opcional en un proyecto. Con una sola unidad, los proyectos la reciben solos; con varias, se elige una (o ninguna) al crearlo.
          Desactivarla deja de ofrecerla para proyectos nuevos y los que ya la tienen la conservan.
        </Callout>
        {!canManage && <Callout variant="info">Solo un administrador puede crear o cambiar unidades de negocio.</Callout>}
        <MutationError error={update.error} fallback="No se pudo actualizar la unidad." />
        {isLoading && <DataListSkeleton label="Unidades de negocio" columns={3} />}
        {error && <LoadError what="las unidades de negocio" />}
        {units && (
          <DataList label="Unidades de negocio" rows={units} columns={columns} rowKey={unit => unit.id} {...(canManage && { actions })} collapseAt="sm"
            empty="Todavía no hay unidades de negocio. No hacen falta para registrar proyectos; créalas si quieres agruparlos." />
        )}
      </Stack>
      <UnitDialog unit={editing ?? null} open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} />
    </Page>
  );
}
