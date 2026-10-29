import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/auth/legal-page";

export const Route = createFileRoute("/privacidad")({
  component: () => (
    <LegalPage title="Política de privacidad" version="2026-10" paragraphs={[
      "Usamos tu nombre, correo y RUT para identificarte en la plataforma y para enviarte los avisos de tu cuenta, como la invitación o la recuperación de contraseña.",
      "Tu sesión se guarda en cookies seguras que solo la plataforma puede leer.",
      "Texto de ejemplo de la maqueta: el contenido definitivo lo entrega el área legal.",
    ]} />
  ),
  head: () => ({ meta: [{ title: "Política de privacidad | Ecosistema X" }] }),
});
