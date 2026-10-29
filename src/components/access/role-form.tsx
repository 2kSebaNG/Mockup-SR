import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert, fieldError } from "@/components/access/access-ui";
import { permissionCatalog, permissionDefinitions, permissionsOf, type AccessError, type AccessState, type Employee, type PermissionCode, type Role, type RoleInput } from "@/lib/access";

/**
 * A role's name, description and permissions, grouped as the catalog groups them. Only the permissions the actor
 * holds can be switched; the rest show their current value, locked, because granting or removing them is refused.
 */
export function RoleForm({ state, actor, role, readOnly, busy, error, submitLabel, onSubmit, onCancel }: {
  state: AccessState; actor: Employee; role?: Role; readOnly: boolean; busy: boolean; error: AccessError | null;
  submitLabel: string; onSubmit: (input: RoleInput) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<PermissionCode[]>(role?.permissions ?? []);
  const mine = new Set(permissionsOf(state, actor));
  const admin = actor.roleIds.some(id => state.roles.find(candidate => candidate.id === id)?.isSystem);
  const editable = (code: PermissionCode) => !readOnly && (admin || mine.has(code));
  const toggle = (code: PermissionCode, on: boolean) => setPermissions(current => (on ? [...current, code] : current.filter(value => value !== code)));
  const nameError = fieldError(error, "name") ?? (error?.code === "ROLE_NAME_TAKEN" ? error.message : undefined);
  const general = error && !error.details && error.code !== "ROLE_NAME_TAKEN" ? error : null;

  return (
    <form className="access-form" noValidate onSubmit={event => { event.preventDefault(); onSubmit({ name, description, permissions }); }}>
      <FieldGroup>
        <ErrorAlert error={general} />
        <section className="access-card">
          <h2 className="access-card-title">Datos del rol</h2>
          <FieldGroup>
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="role-name">Nombre</FieldLabel>
              <Input id="role-name" maxLength={50} disabled={readOnly} value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(nameError)} />
              <FieldError>{nameError}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldError(error, "description"))}>
              <FieldLabel htmlFor="role-description">Descripción <span className="field-optional">(opcional)</span></FieldLabel>
              <Textarea id="role-description" rows={3} maxLength={250} disabled={readOnly} value={description} onChange={event => setDescription(event.target.value)} />
              <FieldDescription>{description.length}/250 · ayuda a elegir el rol al invitar a alguien.</FieldDescription>
              <FieldError>{fieldError(error, "description")}</FieldError>
            </Field>
          </FieldGroup>
        </section>

        <section className="access-card">
          <div className="permission-heading">
            <h2 className="access-card-title">Permisos</h2>
            <span className="permission-count">{permissions.length} de {permissionDefinitions.length}</span>
          </div>
          {!readOnly && !admin && <FieldDescription>Solo puedes otorgar o quitar los permisos que tú tienes; los demás aparecen bloqueados.</FieldDescription>}
          <FieldError>{fieldError(error, "permissions")}</FieldError>
          <div className="permission-groups">
            {permissionCatalog.map(group => {
              const codes = group.permissions.map(permission => permission.code as PermissionCode);
              const switchable = codes.filter(editable);
              const allOn = switchable.length > 0 && switchable.every(code => permissions.includes(code));
              return (
                <fieldset key={group.key} className="permission-group">
                  <legend className="permission-group-title">
                    {group.name}
                    {switchable.length > 1 && (
                      <button type="button" className="permission-all" onClick={() => setPermissions(current => (allOn ? current.filter(code => !switchable.includes(code)) : [...new Set([...current, ...switchable])]))}>
                        {allOn ? "Quitar todos" : "Marcar todos"}
                      </button>
                    )}
                  </legend>
                  {group.permissions.map(permission => {
                    const code = permission.code as PermissionCode;
                    const locked = !editable(code);
                    return (
                      <label key={code} htmlFor={`permission-${code}`} className={`permission-option${locked ? " locked" : ""}`}>
                        <Checkbox id={`permission-${code}`} checked={permissions.includes(code)} disabled={locked} onCheckedChange={checked => toggle(code, checked === true)} />
                        <span>
                          <strong>{permission.name}</strong>
                          <span>{permission.description}</span>
                          {locked && !readOnly && <span className="permission-locked"><Lock aria-hidden="true" />No tienes este permiso</span>}
                        </span>
                        <code className="permission-code">{code}</code>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
        </section>

        {!readOnly && (
          <div className="access-form-actions">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? "Guardando…" : submitLabel}</Button>
          </div>
        )}
      </FieldGroup>
    </form>
  );
}
