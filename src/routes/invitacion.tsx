import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export const Route = createFileRoute("/invitacion")({
  validateSearch: (search: Record<string, unknown>): { error?: string } => (typeof search["error"] === "string" ? { error: search["error"] } : {}),
  component: InvitationPage,
  head: () => ({ meta: [{ title: "Activa tu cuenta | Ecosistema X" }, { name: "referrer", content: "no-referrer" }, { name: "robots", content: "noindex" }] }),
});

function InvitationPage() {
  const { error } = Route.useSearch();
  const navigate = useNavigate();
  // The token travels in the fragment, which never reaches a server: read it once, keep it in memory, and take it out of the address bar.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = () => {
      if (!window.location.hash) return setToken(current => current ?? null);
      setToken(new URLSearchParams(window.location.hash.slice(1)).get("token"));
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    };
    read();
    // A second link pasted into the same tab only changes the fragment.
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <AuthLayout>
      {token !== undefined && <AcceptInvitationForm key={token ?? ""} token={token} redirectError={error} onAccepted={() => void navigate({ to: "/", replace: true })} />}
    </AuthLayout>
  );
}
