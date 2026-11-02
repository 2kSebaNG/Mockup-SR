import { useEffect, useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert, fieldError } from "@/components/access/access-ui";
import { createRole, permissionCatalog, permissionDefinitions, permissionsOf, updateRole, type AccessError, type AccessState, type Employee, type PermissionCode, type Role, type RoleInput } from "@/lib/access";
import { call } from "@/lib/access-store";

const emptyRole: RoleInput = { name: "", description: "", permissions: [] };
const draftOf = (role?: Role): RoleInput => (role ? { name: role.name, description: role.description ?? "", permissions: [...role.permissions] } : emptyRole);

/**
 * A role's name, description and permissions, grouped as the catalog groups them. Only the permissions the actor
 * holds can be switched; the rest show their current value, locked, because granting or removing them is refused.
 * No form element of its own, so it also lives inside the invitation form.
 */
export function RoleFields({ state, actor, value, onChange, readOnly = false, error, idPrefix = "role" }: {
  state: AccessState; actor: Employee; value: RoleInput; onChange: (value: RoleInput) => void; readOnly?: boolean; error: AccessError | null; idPrefix?: string;
}) {
  const mine = new Set(permissionsOf(state, actor));
  const admin = actor.roleIds.some(id => state.roles.find(candidate => candidate.id === id)?.isSystem);
  const editable = (code: PermissionCode) => !readOnly && (admin || mine.has(code));
  const setPermissions = (permissions: PermissionCode[]) => onChange({ ...value, permissions });
  const toggle = (code: PermissionCode, on: boolean) => setPermissions(on ? [...value.permissions, code] : value.permissions.filter(current => current !== code));
  const nameError = fieldError(error, "name") ?? (error?.code === "ROLE_NAME_TAKEN" ? error.message : undefined);

  return (
    <FieldGroup className="role-fields">
      {!readOnly && <>
        <Field data-invalid={Boolean(nameError)}>
          <FieldLabel htmlFor={`${idPrefix}-name`}>Nombre del rol</FieldLabel>
          <Input id={`${idPrefix}-name`} maxLength={50} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} aria-invalid={Boolean(nameError)} />
          <FieldError>{nameError}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldError(error, "description"))}>
          <FieldLabel htmlFor={`${idPrefix}-description`}>Descripción <span className="field-optional">(opcional)</span></FieldLabel>
          <Textarea id={`${idPrefix}-description`} rows={2} maxLength={250} value={value.description} onChange={event => onChange({ ...value, description: event.target.value })} />
          <FieldDescription>{value.description.length}/250 · ayuda a elegir el rol al invitar a alguien.</FieldDescription>
          <FieldError>{fieldError(error, "description")}</FieldError>
        </Field>
      </>}
      <div className="permission-block">
        <div className="permission-heading">
          <span className="permission-title">Permisos</span>
          <span className="permission-count">{value.permissions.length} de {permissionDefinitions.length}</span>
        </div>
        {!readOnly && !admin && <FieldDescription>Solo puedes otorgar o quitar los permisos que tú tienes; los demás aparecen bloqueados.</FieldDescription>}
        <FieldError>{fieldError(error, "permissions")}</FieldError>
        <div className="permission-groups">
          {permissionCatalog.map(group => {
            const codes = group.permissions.map(permission => permission.code as PermissionCode);
            const switchable = codes.filter(editable);
            const allOn = switchable.length > 0 && switchable.every(code => value.permissions.includes(code));
            return (
              <fieldset key={group.key} className="permission-group">
                <legend className="permission-group-title">
                  {group.name}
                  {switchable.length > 1 && (
                    <button type="button" className="permission-all" onClick={() => setPermissions(allOn ? value.permissions.filter(code => !switchable.includes(code)) : [...new Set([...value.permissions, ...switchable])])}>
                      {allOn ? "Quitar todos" : "Marcar todos"}
                    </button>
                  )}
                </legend>
                {group.permissions.map(permission => {
                  const code = permission.code as PermissionCode;
                  const locked = !editable(code);
                  const id = `${idPrefix}-permission-${code}`;
                  return (
                    <label key={code} htmlFor={id} className={`permission-option${locked ? " locked" : ""}${readOnly ? " read-only" : ""}`}>
                      <Checkbox id={id} checked={value.permissions.includes(code)} disabled={locked} onCheckedChange={checked => toggle(code, checked === true)} />
                      <span>
                        <strong>{permission.name}</strong>
                        <span>{permission.description}</span>
                        {locked && !readOnly && <span className="permission-locked"><Lock aria-hidden="true" />No tienes este permiso</span>}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            );
          })}
        </div>
      </div>
    </FieldGroup>
  );
}

/** Creates or saves a role through the mock API; the outcome's error stays on the form. */
function useRoleSave(actor: Employee, role: Role | undefined, onSaved: (role: Role) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  const save = async (input: RoleInput) => {
    setBusy(true); setError(null);
    const outcome = await call(current => (role ? updateRole(current, actor, role.id, input) : createRole(current, actor, input)));
    setBusy(false);
    if (!outcome.ok) { setError(outcome.error); return; }
    toast.success(outcome.message);
    onSaved(outcome.data);
  };
  return { busy, error, setError, save };
}

/** New role or edit one, in a modal. */
export function RoleDialog({ state, actor, role, open, onOpenChange, onSaved }: {
  state: AccessState; actor: Employee; role?: Role | undefined; open: boolean; onOpenChange: (open: boolean) => void; onSaved?: (role: Role) => void;
}) {
  const [value, setValue] = useState<RoleInput>(draftOf(role));
  const { busy, error, setError, save } = useRoleSave(actor, role, saved => { onOpenChange(false); onSaved?.(saved); });
  useEffect(() => { if (open) { setValue(draftOf(role)); setError(null); } }, [open, role]); // eslint-disable-line react-hooks/exhaustive-deps
  const general = error && !error.details && error.code !== "ROLE_NAME_TAKEN" ? error : null;
  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="access-dialog wide">
        <DialogBody>
          <DialogHeader>
            <DialogTitle>{role ? `Editar ${role.name}` : "Nuevo rol"}</DialogTitle>
            <DialogDescription>{role ? "Los cambios rigen desde la siguiente acción de cada empleado con este rol." : "Ponle un nombre que se entienda al invitar a alguien y elige qué podrá hacer."}</DialogDescription>
          </DialogHeader>
          <form id="role-dialog-form" noValidate onSubmit={event => { event.preventDefault(); void save(value); }}>
            <FieldGroup>
              <ErrorAlert error={general} />
              <RoleFields state={state} actor={actor} value={value} onChange={setValue} error={error} idPrefix="role-dialog" />
              <div className="access-form-actions">
                <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? "Guardando…" : role ? "Guardar cambios" : "Crear rol"}</Button>
              </div>
            </FieldGroup>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** A custom role made right below the role choices of the invitation form, without leaving it. */
export function InlineRoleCreator({ state, actor, onCreated, onCancel }: { state: AccessState; actor: Employee; onCreated: (role: Role) => void; onCancel: () => void }) {
  const [value, setValue] = useState<RoleInput>(emptyRole);
  const { busy, error, save } = useRoleSave(actor, undefined, onCreated);
  const general = error && !error.details && error.code !== "ROLE_NAME_TAKEN" ? error : null;
  return (
    <section className="inline-role" aria-label="Crear rol personalizado">
      <div className="inline-role-heading">
        <div>
          <h3>Rol personalizado</h3>
          <p>Se crea en el catálogo de roles y queda asignado a esta persona.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Cerrar rol personalizado" disabled={busy} onClick={onCancel}><X /></Button>
      </div>
      <FieldGroup>
        <ErrorAlert error={general} />
        <RoleFields state={state} actor={actor} value={value} onChange={setValue} error={error} idPrefix="inline-role" />
        <div className="access-form-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>
          {/* Not a submit: this lives inside the invitation form. */}
          <Button type="button" disabled={busy} onClick={() => void save(value)}>{busy && <Loader2 className="animate-spin" />}{busy ? "Creando…" : "Crear y asignar rol"}</Button>
        </div>
      </FieldGroup>
    </section>
  );
}
