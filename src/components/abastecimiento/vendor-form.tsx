import type { ReactNode } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { Combobox, FormRow, IconAction, Optional, RutInput, rutProblem } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bankChoices } from "@/lib/abastecimiento/banks";
import { comunasOf, reconcileComuna } from "@/lib/abastecimiento/territory";
import {
  ACCOUNT_TYPES, DELIVERY_TERMS, MODALITIES, REGIONS, addAccountAsMain, creditChoices, emptyContact, makeMain, makeMainAccount,
  type AccountValues, type ContactValues, type VendorFormValues,
} from "@/lib/abastecimiento/vendors";
import { CategoryPicker } from "./category-picker";

/** The mark of a required field. */
const Required = () => <span className="ab-required" aria-hidden="true">*</span>;

/**
 * A choice from a short list. What is saved and is not one of the choices still shows, so an edit does not lose it;
 * nothing chosen shows the placeholder.
 */
function Choice({ id, value, onChange, choices, placeholder, label }: {
  id: string; value: string; onChange: (value: string) => void; choices: { value: string; label: string }[]; placeholder: string; label?: string;
}) {
  const all = value && !choices.some(choice => choice.value === value) ? [{ value, label: value }, ...choices] : choices;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{all.map(choice => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
const plain = (values: string[]) => values.map(value => ({ value, label: value }));

function Fieldset({ legend, required, children }: { legend: string; required?: boolean; children: ReactNode }) {
  return (
    <fieldset className="ab-fieldset">
      <legend>{legend}{required && <Required />}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The whole vendor in one form, in the sections the source uses wherever it is filled in (this screen and, in phase
 * 2, a purchase order's «crear proveedor»): identification, commercial terms, location, contacts and payment
 * accounts. Everything is required but the giro and a contact's role; `vendorFormProblems` says what is missing.
 */
export function VendorForm({ idPrefix, values, onChange, categories }: {
  idPrefix: string; values: VendorFormValues; onChange: (values: VendorFormValues) => void; categories: string[];
}) {
  const set = (patch: Partial<VendorFormValues>) => onChange({ ...values, ...patch });
  const setContact = (key: string, patch: Partial<ContactValues>) => set({ contacts: values.contacts.map(contact => (contact.key === key ? { ...contact, ...patch } : contact)) });
  const setAccount = (key: string, patch: Partial<AccountValues>) => set({ accounts: values.accounts.map(account => (account.key === key ? { ...account, ...patch } : account)) });
  const comunas = comunasOf(values.region);
  const comunaOptions = plain(values.comuna && !comunas.includes(values.comuna) ? [values.comuna, ...comunas] : comunas);
  const rut = rutProblem(values.taxId);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="ds-meta">Los campos con <span className="ab-required">*</span> son obligatorios.</p>

      <Fieldset legend="Identificación">
        <Field>
          <FieldLabel htmlFor={id("name")}>Nombre<Required /></FieldLabel>
          <Input id={id("name")} maxLength={150} value={values.name} onChange={event => set({ name: event.target.value })} />
        </Field>
        <FormRow>
          <Field data-invalid={Boolean(rut)}>
            <FieldLabel htmlFor={id("taxId")}>RUT<Required /></FieldLabel>
            <RutInput id={id("taxId")} placeholder="76.123.456-7" value={values.taxId} onValueChange={taxId => set({ taxId })} />
            <FieldError>{rut}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={id("legalName")}>Razón social<Required /></FieldLabel>
            <Input id={id("legalName")} placeholder="Nombre legal del proveedor" value={values.legalName} onChange={event => set({ legalName: event.target.value })} />
          </Field>
        </FormRow>
        <Field>
          <FieldLabel htmlFor={id("businessActivity")}>Giro (SII) <Optional /></FieldLabel>
          <Input id={id("businessActivity")} placeholder="Ej. Arriendo de maquinaria y equipo" value={values.businessActivity} onChange={event => set({ businessActivity: event.target.value })} />
        </Field>
      </Fieldset>

      <Fieldset legend="Comercial">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-new-category`}>Categorías<Required /></FieldLabel>
          <CategoryPicker idPrefix={idPrefix} value={values.categories} onChange={next => set({ categories: next })} pool={categories} />
        </Field>
        <FormRow columns={3}>
          <Field>
            <FieldLabel htmlFor={id("creditDays")}>Condición de pago<Required /></FieldLabel>
            <Choice id={id("creditDays")} value={values.creditDays} onChange={creditDays => set({ creditDays })} placeholder="Elige una condición" choices={creditChoices(values.creditDays).filter(choice => choice.value !== "")} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id("modality")}>Modalidad habitual<Required /></FieldLabel>
            <Choice id={id("modality")} value={values.defaultModality} onChange={defaultModality => set({ defaultModality })} placeholder="Elige una modalidad" choices={plain(MODALITIES)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id("delivery")}>Entrega habitual<Required /></FieldLabel>
            <Choice id={id("delivery")} value={values.defaultDeliveryTerms} onChange={defaultDeliveryTerms => set({ defaultDeliveryTerms })} placeholder="Elige una entrega" choices={plain(DELIVERY_TERMS)} />
          </Field>
        </FormRow>
      </Fieldset>

      <Fieldset legend="Ubicación">
        <FormRow>
          <Field>
            <FieldLabel htmlFor={id("region")}>Región<Required /></FieldLabel>
            {/* A comuna belongs to one region: changing the region keeps it only if it is still there. */}
            <Choice id={id("region")} value={values.region} onChange={region => set({ region, comuna: reconcileComuna(region, values.comuna) })} placeholder="Elige una región" choices={plain(REGIONS)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id("comuna")}>Comuna<Required /></FieldLabel>
            <Combobox id={id("comuna")} options={comunaOptions} value={values.comuna || null} onChange={comuna => set({ comuna: comuna ?? "" })} disabled={!values.region}
              placeholder={values.region ? "Elige una comuna" : "Elige primero la región"} searchPlaceholder="Buscar comuna…" />
          </Field>
        </FormRow>
        <Field>
          <FieldLabel htmlFor={id("address")}>Dirección<Required /></FieldLabel>
          <Input id={id("address")} placeholder="Calle y número, ej. Av. Providencia 1234" value={values.address} onChange={event => set({ address: event.target.value })} />
        </Field>
      </Fieldset>

      <Fieldset legend="Contactos" required>
        <p className="ds-meta">Al menos uno, con nombre, teléfono y correo. El primero es el principal: el que sale en la orden de compra.</p>
        <ul className="ab-book">
          {values.contacts.map((contact, index) => (
            <li key={contact.key}>
              <div className="ab-book-head">
                <span className="flex items-center gap-1.5">{index === 0 ? <><Star className="ab-star" aria-hidden="true" />Contacto principal</> : `Contacto ${index + 1}`}</span>
                <span className="flex items-center gap-1">
                  {index > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => set({ contacts: makeMain(values.contacts, contact.key) })}>Hacer principal</Button>}
                  {values.contacts.length > 1 && (
                    <IconAction label={`Quitar el contacto ${contact.name || index + 1}`} danger onClick={() => set({ contacts: values.contacts.filter(other => other.key !== contact.key) })}><Trash2 /></IconAction>
                  )}
                </span>
              </div>
              <FormRow>
                <Input aria-label="Nombre del contacto" placeholder="Nombre *" value={contact.name} onChange={event => setContact(contact.key, { name: event.target.value })} />
                <Input aria-label="Cargo del contacto" placeholder="Cargo (opcional): Ventas, Cobranza…" value={contact.role} onChange={event => setContact(contact.key, { role: event.target.value })} />
                <Input aria-label="Teléfono del contacto" type="tel" placeholder="Teléfono *" value={contact.phone} onChange={event => setContact(contact.key, { phone: event.target.value })} />
                <Input aria-label="Correo del contacto" type="email" placeholder="Correo *" value={contact.email} onChange={event => setContact(contact.key, { email: event.target.value })} />
              </FormRow>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ contacts: [...values.contacts, emptyContact()] })}><Plus />Agregar contacto</Button>
      </Fieldset>

      <Fieldset legend="Cuentas de pago" required>
        <p className="ds-meta">Al menos una, con todos sus datos. Si el proveedor cambia de cuenta, agrega la nueva: pasa a ser la principal (la que usa una orden nueva) y la anterior se conserva.</p>
        <ul className="ab-book">
          {values.accounts.map((account, index) => (
            <li key={account.key}>
              <div className="ab-book-head">
                <span className="flex items-center gap-1.5">{index === 0 ? <><Star className="ab-star" aria-hidden="true" />Cuenta principal</> : `Cuenta ${index + 1}`}</span>
                <span className="flex items-center gap-1">
                  {index > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => set({ accounts: makeMainAccount(values.accounts, account.key) })}>Hacer principal</Button>}
                  {values.accounts.length > 1 && (
                    <IconAction label={`Quitar la cuenta ${index + 1}`} danger onClick={() => set({ accounts: values.accounts.filter(other => other.key !== account.key) })}><Trash2 /></IconAction>
                  )}
                </span>
              </div>
              <FormRow>
                <Input aria-label="Nombre del destinatario" placeholder="Nombre del destinatario *" value={account.recipientName} onChange={event => setAccount(account.key, { recipientName: event.target.value })} />
                <RutInput aria-label="RUT del destinatario" placeholder="RUT del destinatario *" value={account.recipientTaxId} onValueChange={recipientTaxId => setAccount(account.key, { recipientTaxId })} />
                <Choice id={`${idPrefix}-bank-${account.key}`} label="Banco" value={account.bankName} onChange={bankName => setAccount(account.key, { bankName })} placeholder="Banco *" choices={plain(bankChoices(account.bankName))} />
                <Choice id={`${idPrefix}-type-${account.key}`} label="Tipo de cuenta" value={account.accountType} onChange={accountType => setAccount(account.key, { accountType })} placeholder="Tipo de cuenta *" choices={plain(ACCOUNT_TYPES)} />
                <Input aria-label="Número de cuenta" inputMode="numeric" placeholder="N° de cuenta *" value={account.accountNumber} onChange={event => setAccount(account.key, { accountNumber: event.target.value })} />
                <Input aria-label="Correo para el comprobante" type="email" placeholder="Correo para el comprobante *" value={account.email} onChange={event => setAccount(account.key, { email: event.target.value })} />
              </FormRow>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ accounts: addAccountAsMain(values.accounts) })}>
          <Plus />{values.accounts[0]?.bankName ? "Nueva cuenta principal" : "Agregar cuenta"}
        </Button>
      </Fieldset>
    </div>
  );
}
