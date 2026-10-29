import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError } from "@/components/access/access-ui";
import { requestPasswordReset, type AccessError } from "@/lib/access";
import { call } from "@/lib/access-store";

/** login-02's form, asking only for the email; the answer is the same whether the account exists or not. */
export function ForgotPasswordForm({ className, initialEmail = "" }: { className?: string; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    const outcome = await call(current => requestPasswordReset(current, email));
    setBusy(false);
    if (outcome.ok) setSent(outcome.message); else setError(outcome.error);
  };

  if (sent) {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="auth-icon"><MailCheck aria-hidden="true" /></span>
            <h1 className="auth-title">Revisa tu correo</h1>
            <p className="text-sm text-balance text-muted-foreground" role="status">{sent}</p>
          </div>
          <Field>
            <Button asChild><Link to="/login">Volver a iniciar sesión</Link></Button>
            <FieldDescription className="text-center">¿No te llegó? Revisa la carpeta de spam o <button type="button" className="underline underline-offset-4" onClick={() => setSent(null)}>usa otro correo</button>.</FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    );
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={submit} noValidate>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="auth-title">Recupera tu contraseña</h1>
          <p className="text-sm text-balance text-muted-foreground">Te enviaremos un enlace para crear una contraseña nueva</p>
        </div>
        <Field data-invalid={Boolean(fieldError(error, "email"))}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder="nombre@aecon.cl" required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(fieldError(error, "email"))} />
          <FieldError>{fieldError(error, "email")}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? "Enviando…" : "Enviar enlace"}</Button>
          <FieldDescription className="text-center">
            Si entras con Microsoft, tu contraseña se cambia en tu cuenta de Microsoft.
          </FieldDescription>
        </Field>
        <Link to="/login" className="auth-back"><ArrowLeft aria-hidden="true" />Volver a iniciar sesión</Link>
      </FieldGroup>
    </form>
  );
}
