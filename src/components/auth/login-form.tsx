import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MicrosoftIcon } from "@/components/auth/auth-layout";
import { ErrorAlert, fieldError } from "@/components/access/access-ui";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD, login, microsoftLogin, type AccessError } from "@/lib/access";
import { call, useAccess } from "@/lib/access-store";

/** What the login page says for each `?error=` the Microsoft round trip can come back with. */
export const microsoftErrors: Record<string, string> = {
  MICROSOFT_ACCOUNT_NOT_LINKED: "Esa cuenta de Microsoft no corresponde a ningún usuario de Ecosistema X.",
  MICROSOFT_EMAIL_NOT_VERIFIED: "Microsoft no entregó un correo verificado. Inténtalo de nuevo o usa tu contraseña.",
  MICROSOFT_LOGIN_FAILED: "No se pudo iniciar sesión con Microsoft. Inténtalo de nuevo.",
  TERMS_NOT_ACCEPTED: "Debes aceptar los términos y condiciones para continuar.",
  INVITATION_PENDING: "Aún no activas tu cuenta: usa el enlace de tu correo de invitación.",
  ACCOUNT_DEACTIVATED: "La cuenta está desactivada. Contacta a un administrador.",
};

/** The shadcn login-02 form: email, password with the recovery link, sign in, and Microsoft as the other way in. */
export function LoginForm({ className, redirectError, onSignedIn, onMicrosoftError }: {
  className?: string; redirectError?: string | undefined; onSignedIn: () => void; onMicrosoftError: (code: string) => void;
}) {
  const state = useAccess();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccessError | null>(null);
  const [microsoftOpen, setMicrosoftOpen] = useState(false);
  const shown = error ?? (redirectError ? { status: 302, code: redirectError, message: microsoftErrors[redirectError] ?? microsoftErrors["MICROSOFT_LOGIN_FAILED"]! } : null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    const outcome = await call(current => login(current, { email, password }));
    setBusy(false);
    if (outcome.ok) onSignedIn(); else setError(outcome.error);
  };
  const withMicrosoft = async (account: string) => {
    setMicrosoftOpen(false);
    const outcome = await call(current => microsoftLogin(current, account));
    if (outcome.ok) onSignedIn(); else onMicrosoftError(outcome.error.code ?? "MICROSOFT_LOGIN_FAILED");
  };
  // The accounts a Microsoft sign-in could come back with: linked ones, a pending invitation and an unknown one.
  const microsoftAccounts = [
    ...state.employees.filter(employee => employee.signInMethods.includes("microsoft")).map(employee => employee.email),
    ...state.employees.filter(employee => employee.invitation).slice(0, 1).map(employee => employee.email),
    "visitante@outlook.com",
  ];

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={submit} noValidate>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="auth-title">Inicia sesión en tu cuenta</h1>
          <p className="text-sm text-balance text-muted-foreground">Ingresa tu correo de la empresa y tu contraseña</p>
        </div>
        <ErrorAlert error={shown} />
        <Field data-invalid={Boolean(fieldError(error, "email"))}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder="nombre@aecon.cl" required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(fieldError(error, "email"))} />
          <FieldError>{fieldError(error, "email")}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldError(error, "password"))}>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Link to="/recuperar-contrasena" search={email ? { correo: email } : {}} className="ml-auto text-sm underline-offset-4 hover:underline">¿Olvidaste tu contraseña?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(fieldError(error, "password"))} />
          <FieldError>{fieldError(error, "password")}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? "Iniciando sesión…" : "Iniciar sesión"}</Button>
        </Field>
        <FieldSeparator>O continúa con</FieldSeparator>
        <Field>
          <Button variant="outline" type="button" disabled={busy} onClick={() => setMicrosoftOpen(true)}><MicrosoftIcon />Continuar con Microsoft</Button>
          <FieldDescription className="text-center">
            ¿Te invitaron? Activa tu cuenta desde el enlace de tu correo de invitación.
          </FieldDescription>
        </Field>
        <p className="auth-demo-hint">
          Maqueta: entra como administrador con <strong>{DEMO_ADMIN_EMAIL}</strong> y la contraseña <strong>{DEMO_PASSWORD}</strong>. Las demás cuentas de ejemplo usan la misma.
        </p>
      </FieldGroup>

      <Dialog open={microsoftOpen} onOpenChange={setMicrosoftOpen}>
        <DialogContent className="microsoft-dialog">
          <DialogHeader>
            <DialogTitle>Elige una cuenta de Microsoft</DialogTitle>
            <DialogDescription>Simulación: en la app real te lleva a Microsoft y vuelve con la sesión iniciada o con el motivo del error.</DialogDescription>
          </DialogHeader>
          <ul className="microsoft-accounts">
            {microsoftAccounts.map(account => (
              <li key={account}><Button type="button" variant="outline" className="microsoft-account" onClick={() => void withMicrosoft(account)}><MicrosoftIcon />{account}</Button></li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </form>
  );
}
