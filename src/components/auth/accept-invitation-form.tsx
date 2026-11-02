import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle, Loader2, MailX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { MicrosoftIcon } from "@/components/auth/auth-layout";
import { ErrorAlert, fieldError, formatDateTime } from "@/components/access/access-ui";
import { acceptInvitation, inspectInvitation, passwordRules, type AccessError, type InvitationPreview } from "@/lib/access";
import { call } from "@/lib/access-store";

/** The `?error=` codes the Microsoft path of an invitation comes back with. */
const microsoftErrors: Record<string, string> = {
  INVITATION_EMAIL_MISMATCH: "La cuenta de Microsoft no tiene el correo al que te invitaron. Prueba con otra cuenta o crea una contraseña.",
  MICROSOFT_EMAIL_NOT_VERIFIED: "Microsoft no entregó un correo verificado. Inténtalo de nuevo o crea una contraseña.",
  MICROSOFT_ACCOUNT_IN_USE: "Esa cuenta de Microsoft ya está vinculada a otro usuario.",
  MICROSOFT_LOGIN_FAILED: "No se pudo continuar con Microsoft. Inténtalo de nuevo.",
};

function Terminal({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-2 text-center" role="alert">
        <span className="auth-icon warning"><MailX aria-hidden="true" /></span>
        <h1 className="auth-title">{title}</h1>
        <p className="text-sm text-balance text-muted-foreground">{message}</p>
      </div>
      {action && <Field>{action}</Field>}
    </FieldGroup>
  );
}

/**
 * The public invitation page in login-02's form: who was invited, the terms to accept, and the two ways to activate
 * the account (Microsoft or a password), both locked until the terms are accepted. Success opens the session.
 */
export function AcceptInvitationForm({ className, token, redirectError, onAccepted }: { className?: string; token: string | null; redirectError?: string | undefined; onAccepted: () => void }) {
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<AccessError | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"password" | "microsoft" | null>(null);
  const [error, setError] = useState<AccessError | null>(redirectError && microsoftErrors[redirectError] ? { status: 302, code: redirectError, message: microsoftErrors[redirectError]! } : null);

  const inspect = useCallback(async (value: string) => {
    const outcome = await call(current => inspectInvitation(current, value));
    if (outcome.ok) { setPreview(outcome.data); setLoadError(null); } else setLoadError(outcome.error);
  }, []);
  useEffect(() => { if (token) void inspect(token); }, [token, inspect]);

  const finish = async (how: "password" | "microsoft") => {
    if (!token || !preview) return;
    setBusy(how); setError(null);
    const versions = { termsVersion: preview.termsVersion, privacyVersion: preview.privacyVersion };
    const outcome = await call(current => acceptInvitation(current, how === "password" ? { token, password, ...versions } : { token, microsoft: true, ...versions }));
    setBusy(null);
    if (outcome.ok) { onAccepted(); return; }
    if (outcome.error.code === "TERMS_VERSION_MISMATCH") { setAccepted(false); void inspect(token); }
    if (["INVITATION_INVALID", "INVITATION_EXPIRED", "INVITATION_ALREADY_ACCEPTED"].includes(outcome.error.code ?? "")) setLoadError(outcome.error);
    else setError(outcome.error);
  };

  const rulesMet = passwordRules.every(rule => rule.test(password));
  const mismatch = confirm.length > 0 && confirm !== password;

  let body: React.ReactNode;
  if (!token) {
    body = <Terminal title="Abre el enlace de tu correo" message={redirectError === "MICROSOFT_LOGIN_FAILED" ? "Vuelve a abrir el enlace de tu correo de invitación para continuar." : "Para activar tu cuenta usa el enlace del correo «Te invitaron a Ecosistema X». Si no lo encuentras, pídele uno nuevo a quien te invitó."} action={<Button asChild variant="outline"><Link to="/login">Ir a iniciar sesión</Link></Button>} />;
  } else if (loadError) {
    const titles: Record<string, string> = { INVITATION_EXPIRED: "El enlace venció", INVITATION_ALREADY_ACCEPTED: "Ya activaste tu cuenta", INVITATION_INVALID: "El enlace no es válido" };
    body = <Terminal title={titles[loadError.code ?? ""] ?? "No pudimos abrir la invitación"} message={loadError.message}
      action={loadError.code === "INVITATION_ALREADY_ACCEPTED" ? <Button asChild><Link to="/login">Iniciar sesión</Link></Button> : undefined} />;
  } else if (!preview) {
    body = (
      <FieldGroup aria-busy="true" aria-label="Cargando la invitación">
        <div className="flex flex-col items-center gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-56" /></div>
        <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" />
      </FieldGroup>
    );
  } else {
    body = (
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="auth-title">Hola, {preview.firstName}</h1>
          <p className="text-sm text-balance text-muted-foreground">Activa tu cuenta <strong className="text-foreground">{preview.email}</strong>. El enlace vence el {formatDateTime(preview.expiresAt)}</p>
        </div>
        <ErrorAlert error={error && !error.details ? error : null} />
        <Field orientation="horizontal" className="auth-terms">
          <Checkbox id="terms" checked={accepted} onCheckedChange={checked => setAccepted(checked === true)} />
          <FieldLabel htmlFor="terms" className="font-normal">
            <span>Acepto los <a href="/terminos" target="_blank" rel="noreferrer" className="underline underline-offset-4">Términos</a> y la <a href="/privacidad" target="_blank" rel="noreferrer" className="underline underline-offset-4">Política de Privacidad</a></span>
          </FieldLabel>
        </Field>
        <Field>
          <Button variant="outline" type="button" disabled={!accepted || busy !== null} onClick={() => void finish("microsoft")}>
            {busy === "microsoft" ? <Loader2 className="animate-spin" /> : <MicrosoftIcon />}Continuar con Microsoft
          </Button>
        </Field>
        <FieldSeparator>O crea una contraseña</FieldSeparator>
        <form className="contents" onSubmit={event => { event.preventDefault(); if (rulesMet && !mismatch && confirm) void finish("password"); }} noValidate>
          <Field data-invalid={Boolean(fieldError(error, "password"))} data-disabled={!accepted}>
            <FieldLabel htmlFor="new-password">Contraseña</FieldLabel>
            <PasswordInput id="new-password" autoComplete="new-password" disabled={!accepted} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="password-rules" aria-invalid={Boolean(fieldError(error, "password"))} />
            <ul id="password-rules" className="password-rules" aria-label="Requisitos de la contraseña">
              {passwordRules.map(rule => {
                const met = rule.test(password);
                return <li key={rule.key} className={met ? "met" : undefined}>{met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}{rule.label}<span className="sr-only">{met ? " (cumplido)" : " (pendiente)"}</span></li>;
              })}
            </ul>
            <FieldError>{fieldError(error, "password")}</FieldError>
          </Field>
          <Field data-invalid={mismatch} data-disabled={!accepted}>
            <FieldLabel htmlFor="confirm-password">Repite la contraseña</FieldLabel>
            <PasswordInput id="confirm-password" autoComplete="new-password" disabled={!accepted} value={confirm} onChange={event => setConfirm(event.target.value)} aria-invalid={mismatch} />
            <FieldError>{mismatch ? "Las contraseñas no coinciden." : undefined}</FieldError>
          </Field>
          <Field>
            <Button type="submit" disabled={!accepted || !rulesMet || mismatch || !confirm || busy !== null}>{busy === "password" && <Loader2 className="animate-spin" />}{busy === "password" ? "Activando…" : "Activar mi cuenta"}</Button>
            <FieldDescription className="text-center">No puede contener tu nombre, tu correo ni tu RUT.</FieldDescription>
          </Field>
        </form>
      </FieldGroup>
    );
  }
  return <div className={cn("flex flex-col gap-6", className)}>{body}</div>;
}
