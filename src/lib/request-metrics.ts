import { addDays, daysBetween, dueState, pendingStatuses, type MyRequest, type RequestStatus } from "./my-requests";

// What the dashboards show, computed from the requests the page already has (after its filters).

const pending = (request: MyRequest) => pendingStatuses.includes(request.status);
const resolvedByDecision = (request: MyRequest) => (request.status === "Completada" || request.status === "Rechazado") && request.resolvedAt !== null;

/** Monday of the week an ISO date falls in. */
export function weekStart(iso: string) {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
}

/** The last `count` weeks up to today's, oldest first, as their Monday. */
export function lastWeeks(today: string, count: number) {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * (count - 1 - index)));
}

/** The last `count` days up to today, oldest first. */
export function lastDays(today: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

const shortDate = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", timeZone: "UTC" });
export const formatShortDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

export type RequesterKpis = { active: number; completed: number; overdue: number; averageResolutionDays: number | null };

export function requesterKpis(requests: MyRequest[], today: string): RequesterKpis {
  const resolved = requests.filter(resolvedByDecision);
  const average = resolved.length ? resolved.reduce((sum, request) => sum + daysBetween(request.createdAt, request.resolvedAt!), 0) / resolved.length : null;
  return {
    active: requests.filter(pending).length,
    completed: requests.filter(request => request.status === "Completada").length,
    overdue: requests.filter(request => dueState(request, today) === "overdue").length,
    averageResolutionDays: average === null ? null : Math.round(average * 10) / 10,
  };
}

/** Requests created and completed in each of the last weeks. */
export function createdVsCompleted(requests: MyRequest[], today: string, weeks = 8) {
  return lastWeeks(today, weeks).map(week => {
    const inWeek = (iso: string | null) => iso !== null && weekStart(iso) === week;
    return {
      week: formatShortDate(week),
      creadas: requests.filter(request => inWeek(request.createdAt)).length,
      completadas: requests.filter(request => request.status === "Completada" && inWeek(request.resolvedAt)).length,
    };
  });
}

export type Slice = { key: string; label: string; count: number };

/** Requests per category, largest first; past `max` slices the rest fold into "Otras" so colors stay distinguishable. */
export function byCategory(requests: MyRequest[], max = 6): Slice[] {
  const counts = new Map<string, number>();
  for (const request of requests) counts.set(request.category, (counts.get(request.category) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([label, count]) => ({ key: label, label, count }));
  if (sorted.length <= max) return sorted;
  const rest = sorted.slice(max - 1).reduce((sum, slice) => sum + slice.count, 0);
  return [...sorted.slice(0, max - 1), { key: "otras", label: "Otras", count: rest }];
}

/** Pending requests due within `days` (or already overdue), soonest first. */
export function dueSoon(requests: MyRequest[], today: string, days = 7) {
  return requests
    .filter(request => pending(request) && daysBetween(today, request.dueDate) <= days)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code));
}

/** Delegated requests per department, split by status, plus the requests no department has yet ("Sin clasificar"). */
export const derivationStatuses = ["En gestión", "Completada", "Rechazado", "Anulado"] as const satisfies readonly RequestStatus[];
export function derivationsByDepartment(requests: MyRequest[]) {
  const rows = new Map<string, Record<string, number | string>>();
  for (const request of requests) {
    if (!request.department) continue;
    const row = rows.get(request.department) ?? { department: request.department, "En gestión": 0, Completada: 0, Rechazado: 0, Anulado: 0 };
    row[request.status] = (row[request.status] as number) + 1;
    rows.set(request.department, row);
  }
  const total = (row: Record<string, number | string>) => derivationStatuses.reduce((sum, status) => sum + (row[status] as number), 0);
  return {
    departments: [...rows.values()].sort((a, b) => total(b) - total(a) || String(a["department"]).localeCompare(String(b["department"]), "es")),
    unclassified: {
      Enviada: requests.filter(request => request.status === "Enviada").length,
      "En revisión": requests.filter(request => request.status === "En revisión").length,
    },
  };
}

/** A request is classified when the administrator delegates it or decides it directly. */
export function classifiedOn(request: MyRequest): string | null {
  if (request.delegatedAt) return request.delegatedAt;
  return !request.department && resolvedByDecision(request) ? request.resolvedAt : null;
}

/** Requests received and classified on each of the last days. */
export function receivedVsClassified(requests: MyRequest[], today: string, days = 14) {
  return lastDays(today, days).map(day => ({
    day: formatShortDate(day),
    recibidas: requests.filter(request => request.createdAt === day).length,
    clasificadas: requests.filter(request => classifiedOn(request) === day).length,
  }));
}

/** Per department: what was delegated to it in the last 7 days, and what it rejected in that time. */
export function weeklyDemandByDepartment(requests: MyRequest[], today: string) {
  const since = addDays(today, -6);
  const inWindow = (iso: string | null) => iso !== null && iso >= since && iso <= today;
  const departments = [...new Set(requests.map(request => request.department).filter((name): name is string => name !== null))];
  return departments
    .map(department => ({
      department,
      derivadas: requests.filter(request => request.department === department && inWindow(request.delegatedAt)).length,
      rechazadas: requests.filter(request => request.department === department && request.status === "Rechazado" && inWindow(request.resolvedAt)).length,
    }))
    .sort((a, b) => b.derivadas - a.derivadas || b.rechazadas - a.rechazadas || a.department.localeCompare(b.department, "es"));
}
