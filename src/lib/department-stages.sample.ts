import { addDays, daysBetween } from "./my-requests";
import { findDepartment } from "./organization";
import { formatShortDate, lastWeeks, weekStart } from "./request-metrics";

/*
 * SAMPLE DATA. Requests do not have stages yet (a delegated request has one assignee and a decision), so the
 * "Gestión de departamento" dashboard is drawn from this generated set to review its design. Replace
 * `sampleStages` with the real stages once they exist; the metrics below only need the `Stage` shape.
 */

export const stageTypes = ["Validación técnica", "Cotización", "Aprobación de compra", "Despacho", "Recepción"] as const;
export type StageType = (typeof stageTypes)[number];

export type Stage = {
  id: string;
  requestCode: string;
  type: StageType;
  /** Who executes it; null while nobody is responsible. */
  executor: string | null;
  status: "activa" | "completada" | "omitida";
  /** Someone asked to hand it to another executor and it has not been reassigned yet. */
  reassignmentPending: boolean;
  reassignFrom: string | null;
  startedAt: string;
  dueAt: string;
  completedAt: string | null;
  estimatedDays: number;
};

// Department staff beyond the heads listed in organization.ts, only for the sample.
const sampleStaff = ["Valentina Rojas", "Matías Herrera", "Constanza Muñoz", "Tomás Fuentes"];

/** Small deterministic generator, so the server and the browser draw the same sample. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const hash = (text: string) => [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);

export function sampleStages(department: string, today: string, count = 72): Stage[] {
  const next = random(hash(department));
  const members = findDepartment(department)?.members.map(member => member.name) ?? [];
  const executors = [...members, ...sampleStaff.slice(0, 4 - Math.min(members.length, 2))];
  const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
  return Array.from({ length: count }, (_, index) => {
    const type = stageTypes[index % stageTypes.length]!;
    const startedAt = addDays(today, -Math.floor(next() * 56));
    const estimatedDays = 2 + stageTypes.indexOf(type) + Math.floor(next() * 3);
    const dueAt = addDays(startedAt, estimatedDays);
    const age = daysBetween(startedAt, today);
    // Older stages are mostly finished; some kinds are skipped more often than others.
    const skipChance = type === "Validación técnica" ? 0.22 : type === "Cotización" ? 0.12 : 0.05;
    const roll = next();
    const status: Stage["status"] = roll < skipChance ? "omitida" : age > estimatedDays + 9 || roll > 0.86 ? "completada" : "activa";
    const actual = Math.max(1, estimatedDays + Math.round((next() - 0.35) * 5));
    const completedAt = status === "completada" ? (addDays(startedAt, actual) > today ? today : addDays(startedAt, actual)) : null;
    const unassigned = status === "activa" && next() < 0.12;
    const reassignmentPending = status === "activa" && !unassigned && next() < 0.2;
    const executor = unassigned ? null : pick(executors);
    return {
      id: `${department}-${index + 1}`,
      requestCode: `REQ-${1300 + Math.floor(index / 2)}`,
      type,
      executor,
      status,
      reassignmentPending,
      reassignFrom: reassignmentPending ? executor : null,
      startedAt,
      dueAt,
      completedAt,
      estimatedDays,
    };
  });
}

export function stageKpis(stages: Stage[], today: string) {
  const active = stages.filter(stage => stage.status === "activa");
  return {
    active: active.length,
    unassigned: active.filter(stage => stage.executor === null).length,
    reassignments: active.filter(stage => stage.reassignmentPending).length,
    overdue: active.filter(stage => stage.dueAt < today).length,
  };
}

/** Active stages per executor, split by stage type. */
export function workloadByExecutor(stages: Stage[]) {
  const rows = new Map<string, Record<string, number | string>>();
  for (const stage of stages) {
    if (stage.status !== "activa" || !stage.executor) continue;
    const row = rows.get(stage.executor) ?? { executor: stage.executor, ...Object.fromEntries(stageTypes.map(type => [type, 0])) };
    row[stage.type] = (row[stage.type] as number) + 1;
    rows.set(stage.executor, row);
  }
  const total = (row: Record<string, number | string>) => stageTypes.reduce((sum, type) => sum + (row[type] as number), 0);
  return [...rows.values()].sort((a, b) => total(b) - total(a));
}

/** Average days a completed stage took, per stage type. */
export function averageDaysByType(stages: Stage[]) {
  return stageTypes.map(type => {
    const done = stages.filter(stage => stage.type === type && stage.completedAt);
    const days = done.length ? done.reduce((sum, stage) => sum + daysBetween(stage.startedAt, stage.completedAt!), 0) / done.length : 0;
    return { type, dias: Math.round(days * 10) / 10 };
  });
}

/** Share of stages of each type that were skipped. */
export function skipRateByType(stages: Stage[]) {
  return stageTypes.map(type => {
    const all = stages.filter(stage => stage.type === type);
    return { type, tasa: all.length ? Math.round((all.filter(stage => stage.status === "omitida").length / all.length) * 100) : 0 };
  });
}

/** Stages completed in each of the last weeks. */
export function completedPerWeek(stages: Stage[], today: string, weeks = 8) {
  return lastWeeks(today, weeks).map(week => ({
    week: formatShortDate(week),
    completadas: stages.filter(stage => stage.completedAt && weekStart(stage.completedAt) === week).length,
  }));
}

/** Average estimated vs actual days of the stages completed each week. */
export function estimateVsActual(stages: Stage[], today: string, weeks = 8) {
  return lastWeeks(today, weeks).map(week => {
    const done = stages.filter(stage => stage.completedAt && weekStart(stage.completedAt) === week);
    const average = (values: number[]) => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null);
    return {
      week: formatShortDate(week),
      estimado: average(done.map(stage => stage.estimatedDays)),
      real: average(done.map(stage => daysBetween(stage.startedAt, stage.completedAt!))),
    };
  });
}

/** Active stages nobody is responsible for, or waiting to be handed to someone else; the most overdue first. */
export function stagesNeedingOwner(stages: Stage[]) {
  return stages
    .filter(stage => stage.status === "activa" && (stage.executor === null || stage.reassignmentPending))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
}
