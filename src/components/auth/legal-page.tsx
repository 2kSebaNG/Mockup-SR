import { Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";

/** Terms and privacy live in the front; the backend only checks the version accepted is the current one. */
export function LegalPage({ title, version, paragraphs }: { title: string; version: string; paragraphs: string[] }) {
  return (
    <AuthLayout>
      <article className="legal-page">
        <h1 className="auth-title">{title}</h1>
        <p className="legal-version">Versión {version}</p>
        {paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <Link to="/login" className="underline underline-offset-4">Ir a iniciar sesión</Link>
      </article>
    </AuthLayout>
  );
}
