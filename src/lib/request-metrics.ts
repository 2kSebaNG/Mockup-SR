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
export const formatShortDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`)).replace(".", "").replace("-", " ");
const monthLabel = new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" });

/** A span of days, both ends included. */
export type Period = { from: string; to: string };
export type Granularity = "day" | "week" | "month";

/** The period a chart over time shows: the chosen range (up to today), or the default window ending today. */
export function periodOr(range: { from: string; to: string }, today: string, defaultDays: number): Period {
  // Days after today have no events yet: drawing them as zeros would read as "nothing happened".
  const end = (iso: string) => (iso > today ? today : iso);
  if (range.from && range.to) return { from: end(range.from), to: end(range.to) };
  if (range.from) return { from: end(range.from), to: today };
  if (range.to) return { from: addDays(end(range.to), -(defaultDays - 1)), to: end(range.to) };
  return { from: addDays(today, -(defaultDays - 1)), to: today };
}

/** Days for up to a month, weeks for up to about six months, months beyond: always a readable number of points. */
export function granularityFor(period: Period): Granularity {
  const days = daysBetween(period.from, period.to) + 1;
  return days <= 31 ? "day" : days <= 183 ? "week" : "month";
}

/** The first day of the bucket an ISO date falls in. */
export function bucketStart(iso: string, unit: Granularity) {
  if (unit === "day") return iso;
  if (unit === "week") return weekStart(iso);
  return `${iso.slice(0, 7)}-01`;
}

const nextBucket = (iso: string, unit: Granularity) => {
  if (unit === "day") return addDays(iso, 1);
  if (unit === "week") return addDays(iso, 7);
  const [year, month] = iso.split("-").map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
};

/** Every bucket the period touches, oldest first, with the label its axis shows. */
export function periodBuckets(period: Period, unit = granularityFor(period)) {
  const buckets: { start: string; label: string }[] = [];
  for (let start = bucketStart(period.from, unit); start <= period.to; start = nextBucket(start, unit)) {
    buckets.push({ start, label: unit === "month" ? monthLabel.format(new Date(`${start}T00:00:00Z`)).replace(".", "") : formatShortDate(start > period.from ? start : period.from) });
  }
  return buckets;
}

const unitWords: Record<Granularity, string> = { day: "por día", week: "por semana", month: "por mes" };
/** "06 oct – 18 oct · por día", for chart subtitles. */
export function describePeriod(period: Period) {
  return `${formatShortDate(period.from)} – ${formatShortDate(period.to)} · ${unitWords[granularityFor(period)]}`;
}

/** Counts, per bucket of the period, the requests whose event (creation, completion…) falls in it. */
export function countOverTime<K extends string>(requests: MyRequest[], period: Period, events: Record<K, (request: MyRequest) => string | null>) {
  const unit = granularityFor(period);
  const keys = Object.keys(events) as K[];
  const rows = periodBuckets(period, unit).map(bucket => ({ bucket: bucket.label, start: bucket.start, ...Object.fromEntries(keys.map(key => [key, 0])) }) as { bucket: string; start: string } & Record<K, number>);
  const index = new Map(rows.map((row, position) => [row.start, position]));
  for (const request of requests) {
    for (const key of keys) {
      const date = events[key](request);
      if (!date || date < period.from || date > period.to) continue;
      const position = index.get(bucketStart(date, unit));
      if (position !== undefined) rows[position]![key]++;
    }
  }
  return rows;
}

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

/** Requests created and completed in each bucket of the period. */
export function createdVsCompleted(requests: MyRequest[], period: Period) {
  return countOverTime(requests, period, {
    creadas: request => request.createdAt,
    completadas: request => (request.status === "Completada" ? request.resolvedAt : null),
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

/** Requests received and classified in each bucket of the period. */
export function receivedVsClassified(requests: MyRequest[], period: Period) {
  return countOverTime(requests, period, { recibidas: request => request.createdAt, clasificadas: classifiedOn });
}

/**
 * Per department: what was delegated to it and what it rejected. Over the last 7 days by default; over a longer
 * chosen period, as a weekly average so periods of any length compare.
 */
export function weeklyDemandByDepartment(requests: MyRequest[], period: Period) {
  const weeks = Math.max(1, (daysBetween(period.from, period.to) + 1) / 7);
  const perWeek = (count: number) => Math.round((count / weeks) * 10) / 10;
  const inWindow = (iso: string | null) => iso !== null && iso >= period.from && iso <= period.to;
  const departments = [...new Set(requests.map(request => request.department).filter((name): name is string => name !== null))];
  return departments
    .map(department => ({
      department,
      derivadas: perWeek(requests.filter(request => request.department === department && inWindow(request.delegatedAt)).length),
      rechazadas: perWeek(requests.filter(request => request.department === department && request.status === "Rechazado" && inWindow(request.resolvedAt)).length),
    }))
    .sort((a, b) => b.derivadas - a.derivadas || b.rechazadas - a.rechazadas || a.department.localeCompare(b.department, "es"));
}
