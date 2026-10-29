import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";

/** Microsoft's four squares, for "Continuar con Microsoft". */
export function MicrosoftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 2h9.5v9.5H2z" fill="#f25022" />
      <path d="M12.5 2H22v9.5h-9.5z" fill="#7fba00" />
      <path d="M2 12.5h9.5V22H2z" fill="#00a4ef" />
      <path d="M12.5 12.5H22V22h-9.5z" fill="#ffb900" />
    </svg>
  );
}

/**
 * The shadcn login-02 block: the form centred in the left column under the brand, and a full-height visual on the
 * right from `lg` up. The visual is the sidebar's graphite with the brand, so sign-in reads as the same product.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 font-medium">
            <div className="auth-brand-mark flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">X</div>
            <span className="auth-brand-name">ECOSISTEMA X</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="auth-visual relative hidden lg:block" aria-hidden="true">
        <div className="auth-visual-grid" />
        <div className="auth-visual-copy">
          <span className="auth-visual-mark">X</span>
          <p className="auth-visual-eyebrow">ECOSISTEMA X</p>
          <p className="auth-visual-title">Gestión conectada para todas las áreas de la empresa</p>
          <p className="auth-visual-text">Solicitudes, personas y accesos en un solo lugar, con los permisos que cada rol necesita.</p>
        </div>
      </div>
    </div>
  );
}
