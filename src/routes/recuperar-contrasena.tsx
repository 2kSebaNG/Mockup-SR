import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const Route = createFileRoute("/recuperar-contrasena")({
  validateSearch: (search: Record<string, unknown>): { correo?: string } => (typeof search["correo"] === "string" ? { correo: search["correo"] } : {}),
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Recuperar contraseña | Ecosistema X" }, { name: "description", content: "Pide un enlace para crear una contraseña nueva." }] }),
});

function ForgotPasswordPage() {
  return <AuthLayout><ForgotPasswordForm initialEmail={Route.useSearch().correo ?? ""} /></AuthLayout>;
}
