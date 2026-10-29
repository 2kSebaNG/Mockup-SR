import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AccessPage, useActor } from "@/components/access/access-ui";
import { EmployeeForm } from "@/components/access/employee-form";
import { createEmployee, type AccessError } from "@/lib/access";
import { call } from "@/lib/access-store";

export const Route = createFileRoute("/empleados/nuevo")({
  component: () => <AccessPage trail={["Personas y accesos", "Empleados", "Invitar"]} title="Invitar empleado" permission="employees.invite"><NewEmployeePage /></AccessPage>,
  head: () => ({ meta: [{ title: "Invitar empleado | Ecosistema X" }] }),
});

function NewEmployeePage() {
  const { state, actor } = useActor();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);

  return (
    <div className="my-requests access-narrow">
      <Link to="/empleados" className="access-back"><ArrowLeft aria-hidden="true" />Empleados</Link>
      <p className="eyebrow">PERSONAS Y ACCESOS</p>
      <h1 className="page-heading">Invitar empleado</h1>
      <p className="page-description">Registra sus datos y sus roles. Recibirá un correo para aceptar los términos y entrar con contraseña o con Microsoft.</p>
      <section className="access-card">
        <EmployeeForm state={state} actor={actor} submitLabel="Invitar empleado" busyLabel="Invitando…" busy={busy} error={error}
          onCancel={() => void navigate({ to: "/empleados" })}
          onSubmit={async input => {
            setBusy(true); setError(null);
            const outcome = await call(current => createEmployee(current, actor, input));
            setBusy(false);
            if (!outcome.ok) { setError(outcome.error); return; }
            toast.success(outcome.message, { description: `Enviamos la invitación a ${outcome.data.email}.` });
            await navigate({ to: "/empleados/$id", params: { id: outcome.data.id } });
          }} />
      </section>
    </div>
  );
}
