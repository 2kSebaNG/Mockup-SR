import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { sessionEmployee } from "@/lib/access";
import { useAccess, useAccessReady } from "@/lib/access-store";

type LoginSearch = { redirect?: string; error?: string };

/** Only internal paths: an external return URL is dropped, as the backend does. */
const safeRedirect = (value: unknown) => (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : undefined);

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const redirect = safeRedirect(search["redirect"]);
    return { ...(redirect && { redirect }), ...(typeof search["error"] === "string" && { error: search["error"] }) };
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Iniciar sesión | Ecosistema X" }, { name: "description", content: "Inicia sesión en Ecosistema X con tu correo o tu cuenta de Microsoft." }] }),
});

function LoginPage() {
  const { redirect, error } = Route.useSearch();
  const navigate = useNavigate();
  const state = useAccess();
  const ready = useAccessReady();
  const goOn = () => void navigate({ to: redirect ?? "/", replace: true });
  // Someone already signed in has nothing to do here.
  useEffect(() => { if (ready && sessionEmployee(state)) goOn(); }, [ready, state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthLayout>
      <LoginForm key={error ?? ""} redirectError={error} onSignedIn={goOn}
        onMicrosoftError={code => void navigate({ to: "/login", search: { ...(redirect && { redirect }), error: code }, replace: true })} />
    </AuthLayout>
  );
}
