import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/auth/legal-page";

export const Route = createFileRoute("/terminos")({
  component: () => (
    <LegalPage title="Términos y condiciones" version="2026-10" paragraphs={[
      "Ecosistema X es la plataforma interna de la empresa para gestionar solicitudes, personas y accesos. Tu cuenta es personal: no la compartas.",
      "Lo que ves y lo que puedes hacer depende de los permisos de tus roles. Cada acción queda registrada con tu nombre y la fecha.",
      "Texto de ejemplo de la maqueta: el contenido definitivo lo entrega el área legal.",
    ]} />
  ),
  head: () => ({ meta: [{ title: "Términos y condiciones | Ecosistema X" }] }),
});
