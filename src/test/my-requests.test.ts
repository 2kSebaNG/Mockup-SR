import { describe, expect, it } from "vitest";
import { canCancel, canDecide, canDecideAsReviewer, canEdit, countByStatus, normalizeLegacyStatus, startsReview, defaultSort, dueState, emptyFilters, filterRequests, paginate, sampleRequests, seedRequests, sortRequests } from "@/lib/my-requests";

const today = "2026-10-15";
const requests = sampleRequests(today);

describe("My requests", () => {
  it("allows editing only while the request is pending and annulling until it is annulled", () => {
    expect(canEdit("Enviada")).toBe(true);
    expect(canEdit("En revisión")).toBe(true);
    expect(canEdit("En gestión")).toBe(true);
    expect(canEdit("Completada")).toBe(false);
    expect(canEdit("Rechazado")).toBe(false);
    expect(canCancel("Completada")).toBe(true);
    expect(canCancel("Anulado")).toBe(false);
  });
  it("warns about pending requests that are due soon or overdue", () => {
    expect(dueState({ status: "En gestión", dueDate: "2026-10-18" }, today)).toBe("soon");
    expect(dueState({ status: "En revisión", dueDate: "2026-10-14" }, today)).toBe("overdue");
    expect(dueState({ status: "Enviada", dueDate: "2026-10-15" }, today)).toBe("soon");
    expect(dueState({ status: "Enviada", dueDate: "2026-10-19" }, today)).toBeNull();
    expect(dueState({ status: "Enviada", dueDate: "2026-10-14" }, today)).toBe("overdue");
    expect(dueState({ status: "Completada", dueDate: "2026-10-16" }, today)).toBeNull();
  });
  it("seeds other requesters and keeps delegated requests assigned", () => {
    const seeded = seedRequests(today);
    expect(new Set(seeded.map(r => r.requester.email)).size).toBeGreaterThan(1);
    expect(new Set(seeded.map(r => r.code)).size).toBe(seeded.length);
    expect(seeded.filter(r => r.status === "En gestión").every(r => r.department && r.assignee && r.delegatedAt)).toBe(true);
    expect(seeded.filter(r => r.status === "Enviada" || r.status === "En revisión").every(r => !r.department && !r.assignee)).toBe(true);
    expect(seeded.filter(r => r.status === "Completada" || r.status === "Rechazado").every(r => r.resolvedAt && r.resolvedAt <= today && r.resolvedAt >= r.createdAt)).toBe(true);
  });
  it("lets the administrator review and decide until a department has the request, then only the department decides", () => {
    expect(canDecide("Enviada")).toBe(true);
    expect(canDecide("En revisión")).toBe(true);
    expect(canDecide("En gestión")).toBe(false);
    expect(startsReview("Enviada")).toBe(true);
    expect(startsReview("En revisión")).toBe(false);
    expect(canDecideAsReviewer("En gestión")).toBe(true);
    expect(canDecideAsReviewer("En revisión")).toBe(false);
  });
  it("maps statuses stored before the En revisión / En gestión split", () => {
    expect(normalizeLegacyStatus({ status: "Autorizado" as never, department: null })).toBe("Completada");
    expect(normalizeLegacyStatus({ status: "En revisión", department: "Bodega" })).toBe("En gestión");
    expect(normalizeLegacyStatus({ status: "En revisión", department: null })).toBe("En revisión");
  });
  it("matches the reference summary counts", () => {
    const counts = countByStatus(requests);
    expect([counts["Completada"], counts["En gestión"], counts["Rechazado"], counts["Enviada"] + counts["En revisión"]]).toEqual([15, 5, 2, 10]);
  });
  it("filters by code, status, category and due date range", () => {
    const code = requests[3]!.code;
    expect(filterRequests(requests, { ...emptyFilters, query: code.toLowerCase() }).map(r => r.code)).toEqual([code]);
    expect(filterRequests(requests, { ...emptyFilters, statuses: ["Rechazado"] })).toHaveLength(2);
    expect(filterRequests(requests, { ...emptyFilters, categories: ["Personas"] }).every(r => r.category === "Personas")).toBe(true);
    const ranged = filterRequests(requests, { ...emptyFilters, from: today, to: "2026-10-20" });
    expect(ranged.length).toBeGreaterThan(0);
    expect(ranged.every(r => r.dueDate >= today && r.dueDate <= "2026-10-20")).toBe(true);
  });
  it("sorts by due date in both directions", () => {
    const asc = sortRequests(requests, { key: "dueDate", direction: "asc" }).map(r => r.dueDate);
    expect(asc).toEqual([...asc].sort());
    expect(sortRequests(requests, { key: "dueDate", direction: "desc" }).map(r => r.dueDate)).toEqual([...asc].reverse());
  });
  it("sorts by creation date, newest first by default, with later codes first on the same day", () => {
    const newest = sortRequests(requests, defaultSort);
    expect(newest.map(r => r.createdAt)).toEqual(requests.map(r => r.createdAt).sort().reverse());
    const sameDay = newest.filter(r => r.createdAt === newest[0]!.createdAt).map(r => r.code);
    expect(sameDay).toEqual([...sameDay].sort().reverse());
  });
  it("gives seeded rejections a reason", () => {
    expect(requests.filter(r => r.status === "Rechazado").every(r => (r.rejectionReason?.length ?? 0) >= 10)).toBe(true);
  });
  it("clamps pagination to the available pages", () => {
    const page = paginate(requests, 99, 10);
    expect(page.page).toBe(page.pageCount);
    expect(page.items.length).toBe(requests.length - (page.pageCount - 1) * 10);
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, pageCount: 1, items: [] });
  });
});
