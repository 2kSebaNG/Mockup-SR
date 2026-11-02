import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GripVertical, Loader2, Pencil, Plus } from "lucide-react";
import { FormDialog, LoadError, MutationError, ProcurementHeader, ProcurementPage, useCan } from "@/components/abastecimiento/admin-ui";
import { Badge, Callout, Combobox, DataListSkeleton, EmptyState, IconAction, Optional, Page, Stack } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiErrorText } from "@/lib/abastecimiento/api-error";
import { buildChartAccountTree, chartAccountSubtreeIds, describeChartAccountMove, flattenChartAccountTree, resolveChartAccountMove, type ChartAccountMove } from "@/lib/abastecimiento/chart-account-tree";
import type { ChartAccount } from "@/lib/abastecimiento/data";
import { useChartAccounts, useCreateChartAccount, useKindConflicts, useUpdateChartAccount } from "@/lib/abastecimiento/hooks";
import { MIXED_ADVICE, conflictCounts, conflictText, fixLabel } from "@/lib/abastecimiento/kind-conflicts";
import { procurementViews } from "@/lib/abastecimiento/navigation";
import { CHART_ACCOUNT_ROOT_DROP_ATTR, CHART_ACCOUNT_ROW_ATTR, useChartAccountDrag } from "@/lib/abastecimiento/use-chart-account-drag";
import { cn } from "@/lib/utils";

const to = "/abastecimiento/admin/cuentas";
const title = procurementViews.find(view => view.to === to)!.title;

export const Route = createFileRoute("/abastecimiento/admin/cuentas")({
  component: () => <ProcurementPage to={to}><ChartAccountsPage /></ProcurementPage>,
  head: () => ({ meta: [{ title: `${title} | Ecosistema X` }] }),
});

const accountOption = (account: ChartAccount) => ({ value: account.id, label: `${account.code} · ${account.name}` });

/**
 * Accounts whose kind does not match what is booked to them: the return counts sales on a cost account as costs, and
 * costs on an income account as sales. Where everything booked says the same kind, one click sets it.
 */
function KindConflicts() {
  const { data: conflicts } = useKindConflicts();
  const update = useUpdateChartAccount();
  if (!conflicts || conflicts.length === 0) return null;
  const { fixable, mixed } = conflictCounts(conflicts);
  return (
    <Callout variant="warning" title="Cuentas que no cuadran con su tipo">
      El retorno suma una cuenta como ingreso o como costo según su tipo.{" "}
      {fixable > 0 && `${fixable} ${fixable === 1 ? "se arregla" : "se arreglan"} cambiándole el tipo. `}
      {mixed > 0 && `${mixed} ${mixed === 1 ? "tiene" : "tienen"} ventas y costos a la vez.`}
      <ul className="ab-conflicts mt-3">
        {conflicts.map(conflict => (
          <li key={conflict.id}>
            <div>
              <strong>{conflict.code} · {conflict.name}</strong>
              <div className="text-muted-foreground">{conflictText(conflict)}</div>
              {conflict.suggestedKind === null && <div className="ds-meta mt-1">{MIXED_ADVICE}</div>}
            </div>
            {conflict.suggestedKind !== null && (
              <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: conflict.id, kind: conflict.suggestedKind! })}>{fixLabel(conflict.suggestedKind)}</Button>
            )}
          </li>
        ))}
      </ul>
      {update.isError && <span className="mt-2 block text-destructive">{apiErrorText(update.error, "No se pudo cambiar el tipo de la cuenta.")}</span>}
    </Callout>
  );
}

/** New account (name and parent; the code is given) or edit one (name, parent and kind). */
function AccountDialog({ account, accounts, open, onOpenChange }: { account: ChartAccount | null; accounts: ChartAccount[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateChartAccount();
  const update = useUpdateChartAccount();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [kind, setKind] = useState<"INCOME" | "COST">("COST");
  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? ""); setParentId(account?.parentAccountId ?? null); setKind(account?.kind ?? "COST"); create.reset(); update.reset();
  }, [open, account]); // eslint-disable-line react-hooks/exhaustive-deps
  // An account cannot go under itself or under one of its sub-accounts.
  const blocked = account ? chartAccountSubtreeIds(accounts, account.id) : new Set<string>();
  const options = flattenChartAccountTree(buildChartAccountTree(accounts)).map(row => row.account).filter(candidate => !blocked.has(candidate.id)).map(accountOption);
  const moved = account !== null && parentId !== account.parentAccountId;
  const mutation = account ? update : create;
  const save = () => {
    const done = { onSuccess: () => onOpenChange(false) };
    if (account) update.mutate({ id: account.id, name: name.trim(), parentAccountId: parentId, kind }, done);
    else create.mutate({ name: name.trim(), parentAccountId: parentId ?? undefined }, done);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={account ? `Editar ${account.code} · ${account.name}` : "Nueva cuenta contable"}
      description={account ? undefined : "El código se asigna solo: una cuenta raíz recibe el siguiente número (1, 2, 3…) y una subcuenta, el de su cuenta madre más el siguiente correlativo (1.1, 1.2…)."}
      busy={mutation.isPending} error={mutation.error} errorFallback={account ? "No se pudo guardar la cuenta contable." : "No se pudo crear la cuenta contable."}
      submitLabel={account ? "Guardar cambios" : "Crear cuenta"} busyLabel={account ? "Guardando…" : "Creando…"} canSubmit={name.trim() !== ""} onSubmit={save}>
      <Field>
        <FieldLabel htmlFor="ca-name">Nombre</FieldLabel>
        <Input id="ca-name" maxLength={150} placeholder="Ej. Arriendo - Equipos y Vehículos" value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="ca-parent">Cuenta madre <Optional /></FieldLabel>
        <Combobox id="ca-parent" options={options} value={parentId} onChange={setParentId} placeholder="Sin cuenta madre (cuenta raíz)" searchPlaceholder="Buscar por código o nombre…" />
        {moved && <FieldDescription>Al cambiarla de lugar, su código y el de todas sus subcuentas se vuelven a asignar según la nueva cuenta madre.</FieldDescription>}
      </Field>
      {account && (
        <Field>
          <FieldLabel htmlFor="ca-kind">Tipo</FieldLabel>
          <Select value={kind} onValueChange={value => setKind(value as "INCOME" | "COST")}>
            <SelectTrigger id="ca-kind"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COST">Costo</SelectItem>
              <SelectItem value="INCOME">Ingreso (ventas)</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>Le dice a las alertas hacia dónde está el problema: en un costo, pasarse del presupuesto; en un ingreso, quedar bajo él.</FieldDescription>
        </Field>
      )}
    </FormDialog>
  );
}

/**
 * «Cuentas contables» (source: /admin/chart-accounts): the company's own tree of accounts. An account is created
 * under a parent (its code follows), edited, or dragged by its grip (mouse, finger or pen) onto another account (to go
 * inside it) or onto the edge between two (to change its place); a drop asks before it renumbers.
 */
function ChartAccountsPage() {
  const { data: accounts, isLoading, error } = useChartAccounts();
  const update = useUpdateChartAccount();
  const canManage = useCan("chart-accounts:manage");
  const [editing, setEditing] = useState<ChartAccount | null | undefined>(undefined);
  const [pendingMove, setPendingMove] = useState<{ id: string; move: ChartAccountMove } | null>(null);
  const all = accounts ?? [];
  const { drag, startDrag } = useChartAccountDrag({
    accounts: all,
    enabled: canManage && !pendingMove && editing === undefined,
    onDrop: (id, move) => { update.reset(); setPendingMove({ id, move }); },
  });
  const rows = flattenChartAccountTree(buildChartAccountTree(all));
  const dragging = all.find(account => account.id === drag?.id);
  const rootDrop = drag !== null && resolveChartAccountMove(all, drag.id, { kind: "root" }) !== null;

  const confirmMove = () => {
    if (!pendingMove) return;
    update.mutate({ id: pendingMove.id, parentAccountId: pendingMove.move.parentId, position: pendingMove.move.position }, { onSuccess: () => setPendingMove(null) });
  };

  const zone = (id: string) => (drag?.target?.kind === "row" && drag.target.id === id ? drag.target.zone : null);

  return (
    <Page>
      <ProcurementHeader to={to} actions={canManage && <Button onClick={() => setEditing(null)}><Plus />Nueva cuenta</Button>} />
      <Stack>
        {canManage && <KindConflicts />}
        {!canManage && <Callout variant="info">Solo un administrador puede crear o cambiar cuentas contables.</Callout>}
        {canManage && rows.length > 1 && (
          <p className="ds-meta">
            Arrastra una cuenta por su agarre: suéltala sobre el centro de otra para dejarla dentro, o sobre el borde entre dos para cambiar su posición.
            Los números se reasignan solos. Funciona con mouse y con el dedo; también puedes usar Editar.
          </p>
        )}
        {isLoading && <DataListSkeleton label="Cuentas contables" columns={3} rows={8} />}
        {error && <LoadError what="las cuentas contables" />}
        {accounts && rows.length === 0 && (
          <EmptyState title="Todavía no hay cuentas contables" action={canManage && <Button onClick={() => setEditing(null)}><Plus />Crear la primera</Button>}>
            Crea la primera cuenta raíz para empezar el árbol.
          </EmptyState>
        )}
        {rows.length > 0 && (
          <section className="ds-panel ds-panel--flush" aria-label="Árbol de cuentas contables">
            <Table className="ds-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  {canManage && <TableHead className="ds-align-end">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ account, depth }) => {
                  const where = zone(account.id);
                  return (
                    <TableRow key={account.id} {...{ [CHART_ACCOUNT_ROW_ATTR]: account.id }}
                      className={cn("ab-tree-row", drag?.id === account.id && "ab-tree-row--dragging", where && `ab-tree-row--${where}`)}>
                      <TableCell>
                        <span className="ab-tree-code">
                          {canManage && (
                            <button type="button" className="ab-grip" aria-label={`Arrastrar ${account.name}`} title="Arrastrar para mover o reordenar" onPointerDown={event => startDrag(account.id, event)}>
                              <GripVertical aria-hidden="true" />
                            </button>
                          )}
                          {account.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="ab-tree-name" style={{ paddingLeft: `${depth * 20}px` }}>
                          {depth > 0 && <span className="ab-tree-branch" aria-hidden="true">└</span>}
                          <strong>{account.name}</strong>
                          {account.kind === "INCOME" && <Badge tone="info">Ingreso</Badge>}
                          {!account.active && <Badge tone="neutral">Inactiva</Badge>}
                        </span>
                      </TableCell>
                      {canManage && (
                        <TableCell className="ds-cell-actions">
                          <IconAction label={`Editar ${account.name}`} onClick={() => setEditing(account)}><Pencil /></IconAction>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        )}
      </Stack>

      {/* Fixed to the viewport, not inserted in the page: appearing as a drag starts, they must not push the rows from under the pointer. */}
      {drag && rootDrop && (
        <div {...{ [CHART_ACCOUNT_ROOT_DROP_ATTR]: "" }} className={cn("ab-root-drop", drag.target?.kind === "root" && "ab-root-drop--over")}>
          Soltar aquí para dejarla al final del nivel raíz
        </div>
      )}
      {drag && dragging && (
        <div aria-hidden="true" className="ab-drag-ghost" style={{ transform: `translate(${drag.x + 14}px, ${drag.y + 14}px)` }}>{dragging.code} · {dragging.name}</div>
      )}

      <AccountDialog account={editing ?? null} accounts={all} open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} />

      <AlertDialog open={pendingMove !== null} onOpenChange={open => { if (!open && !update.isPending) setPendingMove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar movimiento</AlertDialogTitle>
            <AlertDialogDescription>{pendingMove && describeChartAccountMove(all, pendingMove.id, pendingMove.move)}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">El código de la cuenta, el de sus subcuentas y el de las cuentas hermanas que cambien de lugar se vuelven a asignar.</p>
          <MutationError error={update.error} fallback="No se pudo mover la cuenta contable." />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>Cancelar</AlertDialogCancel>
            <Button disabled={update.isPending} onClick={confirmMove}>{update.isPending && <Loader2 className="animate-spin" />}{update.isPending ? "Moviendo…" : "Mover"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
