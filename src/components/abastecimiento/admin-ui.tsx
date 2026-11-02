import type { FormEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AccessPage } from "@/components/access/access-ui";
import { Badge, Callout, FormActions, PageHeader } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { can, type PermissionCode } from "@/lib/access";
import { useAccess } from "@/lib/access-store";
import { apiErrorText } from "@/lib/abastecimiento/api-error";
import { MODULE, procurementSections, procurementTrail, procurementViews, type ProcurementPath } from "@/lib/abastecimiento/navigation";

// Pieces every built view of the Abastecimiento module shares: the frame (session, permission, breadcrumb), the
// header from navigation.ts, the active/inactive badge, the API's refusal as a callout and the form modal.

const viewOf = (to: ProcurementPath) => procurementViews.find(view => view.to === to)!;

/** A view of the module inside the app frame, behind the permission navigation.ts gives it. */
export function ProcurementPage({ to, children }: { to: ProcurementPath; children: ReactNode }) {
  const view = viewOf(to);
  return <AccessPage trail={procurementTrail(to)} title={view.title} permission={view.permission}>{children}</AccessPage>;
}

/** Eyebrow «Abastecimiento · Administración», the view's title and description, and its actions. */
export function ProcurementHeader({ to, actions, description }: { to: ProcurementPath; actions?: ReactNode; description?: ReactNode }) {
  const view = viewOf(to);
  const section = procurementSections.find(candidate => candidate.views.includes(view));
  return <PageHeader eyebrow={section ? `${MODULE} · ${section.title}` : MODULE} title={view.title} description={description ?? view.description} actions={actions} />;
}

/** The heading of a block that is a list (a list is its own card): title, a sentence and its actions. */
export function SectionHead({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ab-section-head">
      <div>
        <h2 className="ds-panel-title">{title}</h2>
        {description && <p className="ds-panel-description">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Whether the session holds a permission of the module (what the API checks on each write). */
export function useCan(permission: PermissionCode) {
  return can(useAccess(), permission);
}

/** Active, or out of use (neutral): a catalog row's state. `feminine` for "Activa" (una unidad, una cuenta). */
export function ActiveBadge({ active, feminine = false }: { active: boolean; feminine?: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? (feminine ? "Activa" : "Activo") : feminine ? "Inactiva" : "Inactivo"}</Badge>;
}

/** What the API refused, in Spanish (`apiErrorText`), or nothing. */
export function MutationError({ error, fallback }: { error: unknown; fallback: string }) {
  if (!error) return null;
  return <Callout variant="danger">{apiErrorText(error, fallback)}</Callout>;
}

/**
 * A create or edit form in a modal: title, a sentence, the fields, the API's refusal and the buttons (cancel, then
 * the one primary). Closing is blocked while it saves.
 */
export function FormDialog({ open, onOpenChange, title, description, busy, error, errorFallback, submitLabel, busyLabel = "Guardando…", canSubmit = true, onSubmit, wide = false, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; busy: boolean; error: unknown; errorFallback: string;
  submitLabel: string; busyLabel?: string; canSubmit?: boolean; onSubmit: () => void; wide?: boolean; children: ReactNode;
}) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (canSubmit && !busy) onSubmit(); };
  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent className={wide ? "access-dialog wide" : "access-dialog"}>
        <DialogBody>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <form noValidate onSubmit={submit}>
            <FieldGroup>
              {children}
              <MutationError error={error} fallback={errorFallback} />
              <FormActions sticky={wide}>
                <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy || !canSubmit}>{busy && <Loader2 className="animate-spin" />}{busy ? busyLabel : submitLabel}</Button>
              </FormActions>
            </FieldGroup>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** The view could not load its data. */
export function LoadError({ what }: { what: string }) {
  return <Callout variant="danger" title={`No se pudieron cargar ${what}.`}>Recarga la página para intentarlo de nuevo.</Callout>;
}
