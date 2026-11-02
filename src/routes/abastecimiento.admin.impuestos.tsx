import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormDialog, LoadError, MutationError, ProcurementHeader, ProcurementPage, SectionHead, useCan } from "@/components/abastecimiento/admin-ui";
import { Actions, Badge, Callout, DataList, DataListSkeleton, FormRow, IconAction, Page, Stack, type DataColumn } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/abastecimiento/format";
import { useCreateTaxRate, useDeleteTaxRate, useTaxRates, useUpdateTaxRate } from "@/lib/abastecimiento/hooks";
import { procurementViews } from "@/lib/abastecimiento/navigation";
import { TAX_KINDS, TAX_LABELS, TAX_NOTES, formatRate, isFirstOfKind, parsePercent, rateInForce, ratesOf, taxRateProblems, type TaxRate, type TaxRateKind } from "@/lib/abastecimiento/tax-rates";

const to = "/abastecimiento/admin/impuestos";
const title = procurementViews.find(view => view.to === to)!.title;

export const Route = createFileRoute("/abastecimiento/admin/impuestos")({
  component: () => <ProcurementPage to={to}><TaxRatesPage /></ProcurementPage>,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});

const today = () => new Date().toISOString().slice(0, 10);

/** A rate being added (a readjustment from a day) or corrected. */
function RateDialog({ kind, rate, all, open, onOpenChange }: { kind: TaxRateKind; rate: TaxRate | null; all: TaxRate[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateTaxRate();
  const update = useUpdateTaxRate();
  const [validFrom, setValidFrom] = useState("");
  const [percent, setPercent] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setValidFrom(rate?.validFrom ?? ""); setPercent(rate ? String(rate.percent).replace(".", ",") : ""); setTouched(false); create.reset(); update.reset();
  }, [open, rate]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = rate !== null && isFirstOfKind(rate, all);
  const problems = taxRateProblems({ validFrom, percent });
  const mutation = rate ? update : create;
  const save = () => {
    const done = { onSuccess: () => onOpenChange(false) };
    if (rate) update.mutate({ id: rate.id, percent: parsePercent(percent), ...(!first && { validFrom }) }, done);
    else create.mutate({ kind, validFrom, percent: parsePercent(percent) }, done);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={rate ? `Corregir la tasa de ${TAX_LABELS[kind]}` : `Nueva tasa de ${TAX_LABELS[kind]}`}
      description={rate ? "Las órdenes ya hechas mantienen la tasa con que se hicieron." : "Un reajuste es una tasa nueva desde un día: las anteriores se conservan y cada orden aplica la de su fecha."}
      busy={mutation.isPending} error={mutation.error} errorFallback="No se pudo guardar la tasa." submitLabel={rate ? "Guardar" : "Agregar tasa"}
      canSubmit={problems.length === 0} onSubmit={save}>
      <FormRow>
        <Field data-invalid={touched && problems.some(problem => problem.includes("fecha"))}>
          <FieldLabel htmlFor="rate-from">Rige desde</FieldLabel>
          <Input id="rate-from" type="date" value={validFrom} disabled={first} onChange={event => { setValidFrom(event.target.value); setTouched(true); }} />
          {first && <FieldDescription>La primera tasa mantiene su fecha: cubre los días anteriores.</FieldDescription>}
        </Field>
        <Field data-invalid={touched && problems.some(problem => problem.includes("porcentaje"))}>
          <FieldLabel htmlFor="rate-percent">Porcentaje</FieldLabel>
          <Input id="rate-percent" inputMode="decimal" placeholder="Ej. 15,25" value={percent} onChange={event => { setPercent(event.target.value); setTouched(true); }} />
        </Field>
      </FormRow>
      {touched && problems.length > 0 && <FieldError>{problems.join(" ")}</FieldError>}
    </FormDialog>
  );
}

/** One tax: its rates, the most recent first, the one in force today marked. */
function TaxSection({ kind, rates, canEdit }: { kind: TaxRateKind; rates: TaxRate[]; canEdit: boolean }) {
  const remove = useDeleteTaxRate();
  const [editing, setEditing] = useState<TaxRate | null | undefined>(undefined);
  const own = ratesOf(rates, kind);
  const inForce = rateInForce(rates, kind, today());
  const columns: DataColumn<TaxRate>[] = [
    { key: "from", header: "Rige desde", card: "title", cell: rate => <strong>{formatDate(rate.validFrom)}</strong> },
    { key: "percent", header: "Porcentaje", align: "end", cell: rate => <span className="tabular-nums">{formatRate(rate.percent)}</span> },
    { key: "state", header: "Estado", cell: rate => (rate.id === inForce?.id ? <Badge tone="success">Vigente hoy</Badge> : rate.validFrom > today() ? <Badge tone="info">Programada</Badge> : <Badge tone="neutral">Anterior</Badge>) },
  ];
  const actions = (rate: TaxRate) => {
    const first = isFirstOfKind(rate, rates);
    return (
      <Actions>
        <IconAction label="Corregir la tasa" onClick={() => setEditing(rate)}><Pencil /></IconAction>
        <IconAction label="Quitar la tasa" danger disabled={first || remove.isPending} reason={first ? "La primera tasa no se puede quitar: cubre los días anteriores." : null} onClick={() => remove.mutate(rate.id)}><Trash2 /></IconAction>
      </Actions>
    );
  };
  return (
    <section className="ab-section" aria-label={TAX_LABELS[kind]}>
      <SectionHead title={TAX_LABELS[kind]} description={TAX_NOTES[kind]} actions={canEdit && <Button variant="outline" size="sm" onClick={() => setEditing(null)}><Plus />Nueva tasa</Button>} />
      <MutationError error={remove.error} fallback="No se pudo quitar la tasa." />
      <DataList label={`Tasas de ${TAX_LABELS[kind]}`} rows={own} columns={columns} rowKey={rate => rate.id} {...(canEdit && { actions })} collapseAt="sm" empty="Este impuesto todavía no tiene tasas." />
      <RateDialog kind={kind} rate={editing ?? null} all={rates} open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} />
    </section>
  );
}

/**
 * «Impuestos (SII)» (source: /admin/tax-rates): the IVA and the retention of honorarios with the day each rate
 * starts. A purchase order applies the ones of its date, never typed in it.
 */
function TaxRatesPage() {
  const { data: rates, isLoading, error } = useTaxRates();
  const canEdit = useCan("company:manage");
  return (
    <Page>
      <ProcurementHeader to={to} description="Valores tabulados por el SII. Las órdenes de compra los aplican solos, según su fecha; para un reajuste, agrega la nueva tasa desde el día en que rige." />
      <Stack>
        {!canEdit && <Callout variant="info">No tienes permiso para cambiar los impuestos.</Callout>}
        {isLoading && <DataListSkeleton label="Impuestos" columns={3} rows={3} />}
        {error && <LoadError what="los impuestos" />}
        {rates && TAX_KINDS.map(kind => <TaxSection key={kind} kind={kind} rates={rates} canEdit={canEdit} />)}
      </Stack>
    </Page>
  );
}
