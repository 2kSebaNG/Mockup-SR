import { describe, expect, it } from "vitest";
import { emptyFilters, filterRequests, seedRequests, type MyRequest } from "@/lib/my-requests";
import { bucketStart, byCategory, classifiedOn, createdVsCompleted, derivationsByDepartment, describePeriod, dueSoon, granularityFor, lastWeeks, periodBuckets, periodOr, receivedVsClassified, requesterKpis, weekStart, weeklyDemandByDepartment } from "@/lib/request-metrics";
import { sampleStages, skipRateByType, stageKpis, stagesNeedingOwner, workloadByExecutor } from "@/lib/department-stages.sample";

const today = "2026-10-29";
const requests = seedRequests(today);

describe("Request dashboard metrics", () => {
  it("counts active, completed and overdue requests and averages resolution time", () => {
    const kpis = requesterKpis(requests, today);
    expect(kpis.active).toBe(requests.filter(r => ["Enviada", "En revisión", "En gestión"].includes(r.status)).length);
    expect(kpis.completed).toBe(requests.filter(r => r.status === "Completada").length);
    expect(kpis.averageResolutionDays).toBeGreaterThan(0);
    expect(requesterKpis([], today).averageResolutionDays).toBeNull();
  });
  it("buckets by Monday weeks, oldest first", () => {
    expect(weekStart("2026-10-29")).toBe("2026-10-26");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(lastWeeks(today, 3)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    const weekly = createdVsCompleted(requests, periodOr({ from: "", to: "" }, today, 56));
    expect(weekly).toHaveLength(9);
    expect(weekly.reduce((sum, week) => sum + week.creadas, 0)).toBeGreaterThan(0);
  });
  it("folds categories past the limit into Otras", () => {
    const many = ["A", "B", "C", "D", "E", "F", "G"].map((category, index) => ({ ...requests[0]!, code: `REQ-${index}`, category }));
    const slices = byCategory(many, 4);
    expect(slices.map(slice => slice.label)).toEqual(["A", "B", "C", "Otras"]);
    expect(slices.at(-1)!.count).toBe(4);
  });
  it("lists pending requests due within a week, overdue ones first", () => {
    const soon = dueSoon(requests, today);
    expect(soon.every(r => ["Enviada", "En revisión", "En gestión"].includes(r.status))).toBe(true);
    expect(soon.map(r => r.dueDate)).toEqual([...soon.map(r => r.dueDate)].sort());
  });
  it("splits derivations by department and counts what no department has yet", () => {
    const { departments, unclassified } = derivationsByDepartment(requests);
    expect(unclassified.Enviada + unclassified["En revisión"]).toBe(requests.filter(r => r.status === "Enviada" || r.status === "En revisión").length);
    expect(departments.reduce((sum, row) => sum + ["En gestión", "Completada", "Rechazado", "Anulado"].reduce((total, key) => total + Number(row[key]), 0), 0)).toBe(requests.filter(r => r.department).length);
  });
  it("counts a request as classified when it is delegated or decided directly", () => {
    const base = requests[0]!;
    const direct: MyRequest = { ...base, status: "Completada", department: null, delegatedAt: null, resolvedAt: "2026-10-20" };
    expect(classifiedOn(direct)).toBe("2026-10-20");
    expect(classifiedOn({ ...base, department: "Bodega", delegatedAt: "2026-10-18", status: "Completada", resolvedAt: "2026-10-22" })).toBe("2026-10-18");
    expect(classifiedOn({ ...base, status: "En revisión", department: null, delegatedAt: null, resolvedAt: null })).toBeNull();
    expect(receivedVsClassified(requests, periodOr({ from: "", to: "" }, today, 14))).toHaveLength(14);
    expect(weeklyDemandByDepartment(requests, periodOr({ from: "", to: "" }, today, 7)).every(row => row.derivadas >= 0 && row.rechazadas >= 0)).toBe(true);
  });
});

describe("Dashboard periods", () => {
  it("uses the chosen range, or a default window ending today", () => {
    expect(periodOr({ from: "2026-10-01", to: "2026-10-10" }, today, 14)).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    expect(periodOr({ from: "", to: "" }, today, 14)).toEqual({ from: "2026-10-16", to: today });
    expect(periodOr({ from: "2026-10-20", to: "" }, today, 14)).toEqual({ from: "2026-10-20", to: today });
    expect(periodOr({ from: "2026-10-01", to: "2026-12-31" }, today, 14)).toEqual({ from: "2026-10-01", to: today });
  });
  it("groups by day up to a month, by week up to six months and by month beyond", () => {
    expect(granularityFor({ from: "2026-10-01", to: "2026-10-31" })).toBe("day");
    expect(granularityFor({ from: "2026-08-01", to: "2026-10-31" })).toBe("week");
    expect(granularityFor({ from: "2026-01-01", to: "2026-10-31" })).toBe("month");
    expect(periodBuckets({ from: "2026-08-15", to: "2026-10-29" }, "month").map(bucket => bucket.start)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(bucketStart("2026-10-29", "week")).toBe("2026-10-26");
    expect(describePeriod({ from: "2026-10-06", to: "2026-10-18" })).toBe("06 oct – 18 oct · por día");
  });
  it("counts events inside the period only, in the bucket they fall in", () => {
    const period = { from: "2026-10-20", to: "2026-10-26" };
    const rows = createdVsCompleted(requests, period);
    expect(rows).toHaveLength(7);
    expect(rows.reduce((sum, row) => sum + row.creadas, 0)).toBe(requests.filter(r => r.createdAt >= period.from && r.createdAt <= period.to).length);
  });
  it("filters the range on the chosen date, or on the view's default", () => {
    const range = { ...emptyFilters, from: "2026-10-20", to: "2026-10-26" };
    expect(filterRequests(requests, range).every(r => r.dueDate >= range.from && r.dueDate <= range.to)).toBe(true);
    expect(filterRequests(requests, range, "createdAt").every(r => r.createdAt >= range.from && r.createdAt <= range.to)).toBe(true);
    const resolved = filterRequests(requests, { ...range, dateField: "resolvedAt" }, "createdAt");
    expect(resolved.every(r => r.resolvedAt !== null && r.resolvedAt >= range.from && r.resolvedAt <= range.to)).toBe(true);
  });
  it("averages a longer period's demand per week", () => {
    const month = weeklyDemandByDepartment(requests, { from: "2026-10-01", to: "2026-10-28" });
    const raw = requests.filter(r => r.department === month[0]!.department && r.delegatedAt && r.delegatedAt >= "2026-10-01" && r.delegatedAt <= "2026-10-28").length;
    expect(month[0]!.derivadas).toBe(Math.round((raw / 4) * 10) / 10);
  });
});

describe("Sample department stages", () => {
  const stages = sampleStages("Abastecimiento", today);
  it("is deterministic, so the server and the browser draw the same dashboard", () => {
    expect(sampleStages("Abastecimiento", today)).toEqual(stages);
    expect(sampleStages("Bodega", today)).not.toEqual(stages);
  });
  it("keeps the KPIs, workload and owner list consistent with each other", () => {
    const kpis = stageKpis(stages, today);
    expect(stagesNeedingOwner(stages)).toHaveLength(kpis.unassigned + kpis.reassignments);
    const assignedActive = stages.filter(stage => stage.status === "activa" && stage.executor).length;
    expect(workloadByExecutor(stages).reduce((sum, row) => sum + Object.values(row).filter((value): value is number => typeof value === "number").reduce((a, b) => a + b, 0), 0)).toBe(assignedActive);
    expect(skipRateByType(stages).every(row => row.tasa >= 0 && row.tasa <= 100)).toBe(true);
  });
});
