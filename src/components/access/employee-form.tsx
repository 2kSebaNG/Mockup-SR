import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorAlert, fieldError } from "@/components/access/access-ui";
import { assignableRoles, formatRut, normalizeRut, type AccessError, type AccessState, type Employee, type EmployeeInput } from "@/lib/access";

/**
 * Registering or editing an employee: names, RUT and roles (plus the email when registering; it changes apart while
 * the invitation is pending). The roles offered are the ones the actor may assign; a role the employee has and the
 * actor could not give stays checked and locked, since removing it would be refused.
 */
export function EmployeeForm({ state, actor, employee, submitLabel, busyLabel, error, busy, onSubmit, onCancel }: {
  state: AccessState; actor: Employee; employee?: Employee; submitLabel: string; busyLabel: string;
  error: AccessError | null; busy: boolean; onSubmit: (input: EmployeeInput) => void; onCancel?: () => void;
}) {
  const [email, setEmail] = useState(employee?.email ?? "");
  const [firstName, setFirstName] = useState(employee?.firstName ?? "");
  const [lastName, setLastName] = useState(employee?.lastName ?? "");
  const [rut, setRut] = useState(employee ? formatRut(employee.rut) : "");
  const [roleIds, setRoleIds] = useState<string[]>(employee?.roleIds ?? []);
  const assignable = assignableRoles(state, actor);
  const assignableIds = new Set(assignable.map(role => role.id));
  const locked = state.roles.filter(role => roleIds.includes(role.id) && !assignableIds.has(role.id));
  const rutValid = rut.trim() === "" || normalizeRut(rut) !== null;
  // A business error with a field (EMAIL_TAKEN, RUT_TAKEN) goes under that field; the rest above the form.
  const codeField: Record<string, string> = { EMAIL_TAKEN: "email", RUT_TAKEN: "rut" };
  const errorFor = (field: string) => fieldError(error, field) ?? (error?.code && codeField[error.code] === field ? error.message : undefined);
  const general = error && !error.details && !(error.code && codeField[error.code]) ? error : null;
  const toggle = (id: string, checked: boolean) => setRoleIds(current => (checked ? [...current, id] : current.filter(value => value !== id)));

  return (
    <form className="access-form" noValidate onSubmit={event => { event.preventDefault(); onSubmit({ email, firstName, lastName, rut, roleIds }); }}>
      <FieldGroup>
        <ErrorAlert error={general} />
        {!employee && (
          <Field data-invalid={Boolean(errorFor("email"))}>
            <FieldLabel htmlFor="employee-email">Correo</FieldLabel>
            <Input id="employee-email" type="email" autoComplete="off" placeholder="nombre@aecon.cl" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(errorFor("email"))} />
            <FieldDescription>Le enviaremos aquí el enlace para activar su cuenta. Vence en 72 horas.</FieldDescription>
            <FieldError>{errorFor("email")}</FieldError>
          </Field>
        )}
        <div className="access-form-row">
          <Field data-invalid={Boolean(errorFor("firstName"))}>
            <FieldLabel htmlFor="employee-first-name">Nombre</FieldLabel>
            <Input id="employee-first-name" autoComplete="off" maxLength={50} value={firstName} onChange={event => setFirstName(event.target.value)} aria-invalid={Boolean(errorFor("firstName"))} />
            <FieldError>{errorFor("firstName")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errorFor("lastName"))}>
            <FieldLabel htmlFor="employee-last-name">Apellidos</FieldLabel>
            <Input id="employee-last-name" autoComplete="off" maxLength={50} value={lastName} onChange={event => setLastName(event.target.value)} aria-invalid={Boolean(errorFor("lastName"))} />
            <FieldError>{errorFor("lastName")}</FieldError>
          </Field>
        </div>
        <Field data-invalid={!rutValid || Boolean(errorFor("rut"))} className="access-rut">
          <FieldLabel htmlFor="employee-rut">RUT</FieldLabel>
          <Input id="employee-rut" autoComplete="off" placeholder="12.345.678-5" value={rut} onChange={event => setRut(event.target.value)}
            onBlur={() => { const normalized = normalizeRut(rut); if (normalized) setRut(formatRut(normalized)); }} aria-invalid={!rutValid || Boolean(errorFor("rut"))} />
          <FieldError>{!rutValid ? "El RUT no es válido. Revisa el dígito verificador." : errorFor("rut")}</FieldError>
        </Field>
        <FieldSet data-invalid={Boolean(errorFor("roleIds"))}>
          <FieldLegend variant="label">Roles</FieldLegend>
          <FieldDescription>Sus permisos son la suma de los permisos de sus roles. Solo puedes asignar roles cuyos permisos tú tienes.</FieldDescription>
          <div className="role-options">
            {assignable.map(role => (
              <label key={role.id} className="role-option" htmlFor={`role-${role.id}`}>
                <Checkbox id={`role-${role.id}`} checked={roleIds.includes(role.id)} onCheckedChange={checked => toggle(role.id, checked === true)} />
                <span><strong>{role.name}</strong>{role.description && <span>{role.description}</span>}</span>
              </label>
            ))}
            {locked.map(role => (
              <label key={role.id} className="role-option locked" htmlFor={`role-${role.id}`}>
                <Checkbox id={`role-${role.id}`} checked disabled />
                <span><strong>{role.name}</strong><span>Tiene permisos que tú no tienes: no puedes quitárselo.</span></span>
              </label>
            ))}
          </div>
          <FieldError>{errorFor("roleIds")}</FieldError>
        </FieldSet>
        <div className="access-form-actions">
          {onCancel && <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? busyLabel : submitLabel}</Button>
        </div>
      </FieldGroup>
    </form>
  );
}
