import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { LoadError, MutationError, ProcurementHeader, ProcurementPage } from "@/components/abastecimiento/admin-ui";
import { Combobox, FormActions, FormRow, MoneyInput, Optional, Page, Panel, RutInput, Stack, rutProblem } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeRut } from "@/lib/access";
import { percentFromInput, percentToInput } from "@/lib/abastecimiento/alerts";
import type { Company } from "@/lib/abastecimiento/data";
import { useChartAccounts, useCompany, useUpdateCompany } from "@/lib/abastecimiento/hooks";
import { procurementViews } from "@/lib/abastecimiento/navigation";

const to = "/abastecimiento/admin/empresa";
const title = procurementViews.find(view => view.to === to)!.title;

export const Route = createFileRoute("/abastecimiento/admin/empresa")({
  component: () => <ProcurementPage to={to}><CompanyPage /></ProcurementPage>,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});

type Values = {
  legalName: string; taxId: string; address: string; businessLine: string; website: string; contactEmails: string; payrollChartAccountId: string | null;
  alertVarianceAmount: number | null; alertVariancePercent: string; alertMinProfitability: string;
};

const valuesOf = (company: Company): Values => ({
  legalName: company.legalName ?? "", taxId: company.taxId ?? "", address: company.address ?? "", businessLine: company.businessLine ?? "",
  website: company.website ?? "", contactEmails: company.contactEmails ?? "", payrollChartAccountId: company.payrollChartAccountId ?? null,
  alertVarianceAmount: company.alertVarianceAmount ?? null, alertVariancePercent: percentToInput(company.alertVariancePercent), alertMinProfitability: percentToInput(company.alertMinProfitability),
});

const percentProblem = (text: string) => (text.trim() !== "" && percentFromInput(text) === null ? "Escribe un porcentaje, por ejemplo 10 o 12,5." : null);

/**
 * «Perfil de la empresa» (source: /admin/company): the letterhead of every purchase order (header: legal name, RUT,
 * address, line of business, website; footer: contact emails), the account payroll is charged to, and the thresholds
 * that make a project raise an alert.
 */
function CompanyPage() {
  const { data: company, isLoading, error } = useCompany();
  const { data: accounts } = useChartAccounts();
  const update = useUpdateCompany();
  const [values, setValues] = useState<Values | null>(null);
  useEffect(() => { if (company) setValues(valuesOf(company)); }, [company]);
  const set = (patch: Partial<Values>) => setValues(current => (current ? { ...current, ...patch } : current));

  const rut = values ? rutProblem(values.taxId) : null;
  const variance = values ? percentProblem(values.alertVariancePercent) : null;
  const minReturn = values ? percentProblem(values.alertMinProfitability) : null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!values || rut || variance || minReturn) return;
    update.mutate({
      legalName: values.legalName.trim() || undefined, taxId: values.taxId.trim() ? (normalizeRut(values.taxId) ?? values.taxId) : undefined,
      address: values.address.trim() || undefined, businessLine: values.businessLine.trim() || undefined, website: values.website.trim() || undefined,
      contactEmails: values.contactEmails.trim() || undefined, payrollChartAccountId: values.payrollChartAccountId ?? undefined,
      alertVarianceAmount: values.alertVarianceAmount, alertVariancePercent: percentFromInput(values.alertVariancePercent), alertMinProfitability: percentFromInput(values.alertMinProfitability),
    });
  };

  return (
    <Page narrow>
      <ProcurementHeader to={to} />
      {isLoading && <Skeleton className="h-96 w-full" />}
      {error && <LoadError what="los datos de la empresa" />}
      {values && (
        <form noValidate onSubmit={save}>
          <Stack>
            <Panel title="Membrete de las órdenes de compra" description="Estos datos encabezan y cierran cada orden de compra generada.">
              <FieldGroup>
                <FormRow>
                  <Field>
                    <FieldLabel htmlFor="company-legal-name">Razón social</FieldLabel>
                    <Input id="company-legal-name" placeholder="Ej. AECON SpA" value={values.legalName} onChange={event => set({ legalName: event.target.value })} />
                  </Field>
                  <Field data-invalid={Boolean(rut)}>
                    <FieldLabel htmlFor="company-tax-id">RUT</FieldLabel>
                    <RutInput id="company-tax-id" value={values.taxId} onValueChange={taxId => set({ taxId })} />
                    <FieldError>{rut}</FieldError>
                  </Field>
                </FormRow>
                <Field>
                  <FieldLabel htmlFor="company-address">Dirección</FieldLabel>
                  <Input id="company-address" value={values.address} onChange={event => set({ address: event.target.value })} />
                </Field>
                <FormRow>
                  <Field>
                    <FieldLabel htmlFor="company-business-line">Rubro</FieldLabel>
                    <Input id="company-business-line" placeholder="Ej. Obras de ingeniería y construcción" value={values.businessLine} onChange={event => set({ businessLine: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="company-website">Sitio web</FieldLabel>
                    <Input id="company-website" placeholder="Ej. www.aecon.cl" value={values.website} onChange={event => set({ website: event.target.value })} />
                  </Field>
                </FormRow>
                <Field>
                  <FieldLabel htmlFor="company-contact-emails">Correos de contacto (pie de la OC)</FieldLabel>
                  <Input id="company-contact-emails" placeholder="Ej. proveedores@aecon.cl - denuncias@aecon.cl" value={values.contactEmails} onChange={event => set({ contactEmails: event.target.value })} />
                  <FieldDescription>Sepáralos con « - », tal como deben verse en el pie de la orden.</FieldDescription>
                </Field>
              </FieldGroup>
            </Panel>

            <Panel title="Remuneraciones" description="La cuenta a la que se carga cada persona importada desde la planilla de remuneraciones.">
              <Field>
                <FieldLabel htmlFor="company-payroll-account">Cuenta contable de remuneraciones <Optional /></FieldLabel>
                <Combobox id="company-payroll-account" value={values.payrollChartAccountId} onChange={id => set({ payrollChartAccountId: id })}
                  options={(accounts ?? []).filter(account => account.active).map(account => ({ value: account.id, label: `${account.code} · ${account.name}` }))}
                  placeholder="Sin configurar" searchPlaceholder="Buscar por código o nombre…" />
              </Field>
            </Panel>

            <Panel title="Alertas de los proyectos" description="Cuándo avisa un proyecto que algo se sale de lo presupuestado. Son los valores de toda la empresa; cada proyecto puede ajustarlos en su reporte. Vacío: no se vigila.">
              <FieldGroup>
                <FormRow columns={3}>
                  <Field>
                    <FieldLabel htmlFor="alert-amount">Variación máxima en pesos</FieldLabel>
                    <MoneyInput id="alert-amount" placeholder="5.000.000" value={values.alertVarianceAmount} onValueChange={alertVarianceAmount => set({ alertVarianceAmount })} />
                    <FieldDescription>Lo que una cuenta o un mes puede pasarse del presupuesto.</FieldDescription>
                  </Field>
                  <Field data-invalid={Boolean(variance)}>
                    <FieldLabel htmlFor="alert-percent">Variación máxima en %</FieldLabel>
                    <Input id="alert-percent" inputMode="decimal" placeholder="Ej. 10" value={values.alertVariancePercent} onChange={event => set({ alertVariancePercent: event.target.value })} />
                    <FieldDescription>Lo mismo, como porcentaje de su presupuesto.</FieldDescription>
                    <FieldError>{variance}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(minReturn)}>
                    <FieldLabel htmlFor="alert-min-return">Retorno mínimo esperado en %</FieldLabel>
                    <Input id="alert-min-return" inputMode="decimal" placeholder="Ej. 15" value={values.alertMinProfitability} onChange={event => set({ alertMinProfitability: event.target.value })} />
                    <FieldDescription>Si el retorno proyectado baja de esto, hay alerta.</FieldDescription>
                    <FieldError>{minReturn}</FieldError>
                  </Field>
                </FormRow>
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-semibold text-foreground">¿Para qué sirven estos umbrales?</summary>
                  <div className="mt-2 space-y-2">
                    <p><strong className="text-foreground">Variación (en pesos y en %).</strong> Avisa cuando algo se pasa de su presupuesto: cada cuenta, cada mes y el total de costos, con real más proyectado. Basta con cruzar uno de los dos umbrales, y si se pasa del doble, la alerta es crítica. En las cuentas de venta es al revés: avisa cuando lo proyectado queda bajo el presupuesto.</p>
                    <p><strong className="text-foreground">Gasto sin presupuesto.</strong> Una cuenta que gasta sin presupuesto avisa solo si hay un umbral en pesos y el gasto lo supera.</p>
                    <p><strong className="text-foreground">Retorno mínimo.</strong> El retorno es (ventas − costos) / ventas. Bajo el mínimo hay advertencia; cinco puntos o más por debajo es crítica, y si el proyecto pierde plata es crítica siempre.</p>
                  </div>
                </details>
              </FieldGroup>
            </Panel>

            <MutationError error={update.error} fallback="No se pudo guardar el perfil de la empresa." />
            <FormActions>
              <Button type="button" variant="outline" disabled={update.isPending || !company} onClick={() => company && setValues(valuesOf(company))}>Descartar cambios</Button>
              <Button type="submit" disabled={update.isPending || Boolean(rut || variance || minReturn)}>{update.isPending ? <Loader2 className="animate-spin" /> : <Save />}{update.isPending ? "Guardando…" : "Guardar"}</Button>
            </FormActions>
          </Stack>
        </form>
      )}
    </Page>
  );
}
