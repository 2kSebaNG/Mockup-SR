import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, useActor } from "@/components/access/access-ui";
import { RoleForm } from "@/components/access/role-form";
import { createRole, type AccessError } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/roles/nuevo")({
  component: () => <AccessPage trail={["Personas y accesos", "Roles", "Nuevo rol"]} title="Nuevo rol" permission="roles.manage"><NewRolePage /></AccessPage>,
  head: () => ({ meta: [{ title: "Nuevo rol | Ecosistema X" }] }),
});

function NewRolePage() {
  const { state, actor } = useActor();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  return (
    <div className="my-requests access-narrow">
      <Link to="/roles" className="access-back"><ArrowLeft aria-hidden="true" />Roles</Link>
      <p className="eyebrow">PERSONAS Y ACCESOS</p>
      <h1 className="page-heading">Nuevo rol</h1>
      <p className="page-description">Ponle un nombre que se entienda al invitar a alguien y elige qué podrá hacer.</p>
      <RoleForm state={state} actor={actor} readOnly={false} busy={busy} error={error} submitLabel="Crear rol" onCancel={() => void navigate({ to: "/roles" })}
        onSubmit={async input => {
          setBusy(true); setError(null);
          const outcome = await call(current => createRole(current, actor, input));
          setBusy(false);
          if (!outcome.ok) { setError(outcome.error); return; }
          toast.success(outcome.message);
          await navigate({ to: "/roles/$id", params: { id: outcome.data.id } });
        }} />
    </div>
  );
}
