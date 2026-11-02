import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleAlert, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PAGE_SIZES, can, permissionName, sessionEmployee, statusLabels, type AccessError, type AccessState, type Employee, type EmployeeStatus, type PermissionCode } from "@/lib/access";
import { useAccess, useAccessReady } from "@/lib/access-store";

// Employee statuses wear the request status tones: active reads as done, pending as sent, expired as waiting, deactivated as off.
const statusTone: Record<EmployeeStatus, string> = { active: "status-completed", pending: "status-sent", expired: "status-review", deactivated: "status-cancelled" };

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <span className={`status-badge ${statusTone[status]}`}>{statusLabels[status]}</span>;
}

const dateTime = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" });
/** API dates are UTC; people read them in their local time. */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDay = (iso: string) => dateOnly.format(new Date(iso));

export const initials = (name: string) => name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase();

/** An API error as an alert: the fixed message, which the backend already writes for people. */
export function ErrorAlert({ error }: { error: AccessError | null }) {
  if (!error) return null;
  return <p role="alert" className="access-alert"><CircleAlert aria-hidden="true" />{error.message}</p>;
}

/** Field errors arrive in `details`; the form shows each under its field. */
export const fieldError = (error: AccessError | null, field: string) => error?.details?.[field];

/** Seconds until an ISO time, ticking each second; 0 once it passed. */
export function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : 0;
}

/** The signed-in employee; only rendered inside `AccessPage`, which guarantees there is one. */
export function useActor(): { state: AccessState; actor: Employee } {
  const state = useAccess();
  return { state, actor: sessionEmployee(state)! };
}

function AccessSkeleton({ title }: { title: string }) {
  return (
    <div className="my-requests" role="status" aria-busy="true" aria-label={`Cargando ${title.toLowerCase()}`}>
      <Skeleton className="skeleton-eyebrow" />
      <h1 className="page-heading">{title}</h1>
      <Skeleton className="skeleton-description" />
      <Skeleton className="skeleton-block" />
      <Skeleton className="skeleton-block" />
    </div>
  );
}

/**
 * An administration page inside the app frame. It needs a session (otherwise it sends to the login and comes back) and
 * the permission the backend asks for; hiding the page is a courtesy, the API answers 403 anyway.
 */
export function AccessPage({ trail, title, permission, children }: { trail: string[]; title: string; permission: PermissionCode; children: ReactNode }) {
  const state = useAccess();
  const ready = useAccessReady();
  const navigate = useNavigate();
  const location = useRouterState({ select: router => router.location.href });
  const signedIn = sessionEmployee(state) !== null;
  // Once: the page stays mounted while the router moves to the login, and its location changes with it.
  const redirected = useRef(false);
  useEffect(() => {
    if (!ready || signedIn) { redirected.current = false; return; }
    if (redirected.current) return;
    redirected.current = true;
    void navigate({ to: "/login", search: { redirect: location }, replace: true });
  }, [ready, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  let content: ReactNode;
  if (!ready || !signedIn) content = <AccessSkeleton title={title} />;
  else if (!can(state, permission)) {
    content = (
      <div className="my-requests">
        <h1 className="page-heading">{title}</h1>
        <div className="access-empty">
          <Lock aria-hidden="true" />
          <h2>No tienes permiso para ver esta página</h2>
          <p>Necesitas el permiso <strong>{permissionName(permission)}</strong>. Pídele a un administrador que lo agregue a uno de tus roles.</p>
          <Button asChild variant="outline"><Link to="/">Volver al inicio</Link></Button>
        </div>
      </div>
    );
  } else content = children;
  return <AppShell trail={trail}><TooltipProvider delayDuration={200}>{content}</TooltipProvider></AppShell>;
}

/** Page size 5, 10 or 25 and previous / next, as the API pages its lists. */
export function AccessPagination({ page, pageSize, totalCount, onPage, onPageSize }: { page: number; pageSize: number; totalCount: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount ? (page - 1) * pageSize + 1 : 0;
  return (
    <footer className="pagination">
      <div className="page-size">
        <span id="access-page-size">Filas por página</span>
        <Select value={String(pageSize)} onValueChange={value => onPageSize(Number(value))}>
          <SelectTrigger aria-labelledby="access-page-size" className="page-size-trigger"><SelectValue /></SelectTrigger>
          <SelectContent>{PAGE_SIZES.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <span className="page-range" aria-live="polite">{totalCount ? `${start}–${Math.min(totalCount, page * pageSize)} de ${totalCount}` : "0 de 0"}</span>
      <div className="page-buttons">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}><ChevronLeft />Anterior</Button>
        <span className="page-number">Página {page} de {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount}>Siguiente<ChevronRight /></Button>
      </div>
    </footer>
  );
}
