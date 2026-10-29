import { describe, expect, it } from "vitest";
import {
  DEMO_PASSWORD, acceptInvitation, assignableRoles, canResendAt, changeEmail, createEmployee, createRole, deactivateEmployee, deleteEmployee, deleteRole,
  employeeStatus, findEmployee, inspectInvitation, listEmployees, login, normalizeRut, permissionsOf, reactivateEmployee, resendInvitation, revokeInvitation,
  rutDv, seedAccess, updateEmployee, updateRole, withinScope, type AccessState, type Outcome,
} from "@/lib/access";

const NOW = Date.parse("2026-10-29T12:00:00Z");
const seed = () => seedAccess(NOW);
const actor = (state: AccessState, id: string) => findEmployee(state, id)!;
const code = <T>(outcome: Outcome<T>) => (outcome.ok ? "ok" : outcome.error.code ?? String(outcome.error.status));
const admin = "emp-1"; // Pablo Contreras, Administrador
const hr = "emp-2"; // Maridel Rojas, Recursos Humanos

describe("RUT", () => {
  it("accepts the three formats and normalizes them", () => {
    const rut = `12345678-${rutDv(12345678)}`;
    expect(normalizeRut("12.345.678-5")).toBe(rut);
    expect(normalizeRut("123456785")).toBe(rut);
    expect(normalizeRut("12345678-4")).toBeNull();
  });
});

describe("login and logout", () => {
  it("opens a session with the right password and hides why a wrong one fails", () => {
    const state = seed();
    expect(code(login(state, { email: "PContreras@aecon.cl", password: DEMO_PASSWORD }, NOW).outcome)).toBe("ok");
    expect(code(login(state, { email: "pcontreras@aecon.cl", password: "x" }, NOW).outcome)).toBe("INVALID_CREDENTIALS");
    expect(code(login(state, { email: "ctorres@aecon.cl", password: DEMO_PASSWORD }, NOW).outcome)).toBe("INVALID_CREDENTIALS");
  });
  it("tells a deactivated account only with the correct password", () => {
    const state = seed();
    expect(code(login(state, { email: "cfuentes@aecon.cl", password: DEMO_PASSWORD }, NOW).outcome)).toBe("ACCOUNT_DEACTIVATED");
    expect(code(login(state, { email: "cfuentes@aecon.cl", password: "nope" }, NOW).outcome)).toBe("INVALID_CREDENTIALS");
  });
  it("locks the account after five failures", () => {
    let state = seed();
    for (let attempt = 0; attempt < 5; attempt++) state = login(state, { email: "vpena@aecon.cl", password: "bad" }, NOW).state;
    expect(code(login(state, { email: "vpena@aecon.cl", password: DEMO_PASSWORD }, NOW).outcome)).toBe("ACCOUNT_LOCKED");
  });
});

describe("roles", () => {
  it("only lets a non-admin grant permissions they hold", () => {
    const state = seed();
    const input = { name: "Auditor", description: "", permissions: ["employees.read", "employees.delete"] as const };
    expect(code(createRole(state, actor(state, hr), { ...input, permissions: [...input.permissions] }, NOW).outcome)).toBe("ROLE_ASSIGNMENT_FORBIDDEN");
    expect(code(createRole(state, actor(state, admin), { ...input, permissions: [...input.permissions] }, NOW).outcome)).toBe("ok");
  });
  it("keeps names unique, the system role read-only and roles in use", () => {
    const state = seed();
    expect(code(createRole(state, actor(state, admin), { name: " supervisor ", description: "", permissions: ["roles.read"] }, NOW).outcome)).toBe("ROLE_NAME_TAKEN");
    expect(code(updateRole(state, actor(state, admin), "role-admin", { name: "Admin", description: "", permissions: ["roles.read"] }).outcome)).toBe("SYSTEM_ROLE_READONLY");
    expect(code(deleteRole(state, "role-supervisor").outcome)).toBe("ROLE_IN_USE");
  });
});

describe("employees", () => {
  it("derives the status from the invitation and the deactivation", () => {
    const state = seed();
    expect(state.employees.map(employee => employeeStatus(employee, NOW))).toEqual(expect.arrayContaining(["active", "deactivated", "pending", "expired"]));
  });
  it("searches names without accents and RUTs with or without dots", () => {
    const state = seed();
    expect(listEmployees(state, { search: "nunez" }, NOW).items.map(employee => employee.email)).toEqual(["snunez@aecon.cl"]);
    expect(listEmployees(state, { search: "12.345.678" }, NOW).items.map(employee => employee.email)).toEqual(["vpena@aecon.cl"]);
  });
  it("invites with assignable roles only and refuses taken emails and RUTs", () => {
    const state = seed();
    const base = { email: "nuevo@aecon.cl", firstName: "Ana María", lastName: "Pérez Soto", rut: "21.000.000-" + rutDv(21000000), roleIds: ["role-colaborador"] };
    expect(code(createEmployee(state, actor(state, hr), { ...base, roleIds: ["role-admin"] }, NOW).outcome)).toBe("ROLE_ASSIGNMENT_FORBIDDEN");
    expect(code(createEmployee(state, actor(state, hr), { ...base, email: "vpena@aecon.cl" }, NOW).outcome)).toBe("EMAIL_TAKEN");
    const created = createEmployee(state, actor(state, hr), base, NOW);
    expect(created.outcome.ok && employeeStatus(created.outcome.data, NOW)).toBe("pending");
  });
  it("never acts on yourself or on someone with more permissions", () => {
    const state = seed();
    expect(withinScope(state, actor(state, hr), actor(state, admin))).toBe(false);
    expect(code(deactivateEmployee(state, actor(state, hr), admin, "", NOW).outcome)).toBe("EMPLOYEE_OUT_OF_SCOPE");
    expect(code(deactivateEmployee(state, actor(state, admin), admin, "", NOW).outcome)).toBe("CANNOT_MODIFY_SELF");
    expect(assignableRoles(state, actor(state, hr)).map(role => role.id)).not.toContain("role-admin");
  });
  it("lets an admin move the admin role to someone else", () => {
    let state = seed();
    state = updateEmployee(state, actor(state, admin), "emp-5", { firstName: "Vladimir", lastName: "Peña", rut: actor(state, "emp-5").rut, roleIds: ["role-admin"] }).state;
    expect(permissionsOf(state, actor(state, "emp-5"))).toContain("employees.delete");
    expect(code(updateEmployee(state, actor(state, "emp-5"), admin, { firstName: "Pablo", lastName: "Contreras", rut: actor(state, admin).rut, roleIds: ["role-supervisor"] }).outcome)).toBe("ok");
  });
  it("sends invitations again within the cooldown and the daily limit", () => {
    const state = seed();
    const pending = "emp-10";
    const resent = resendInvitation(state, actor(state, admin), pending, NOW);
    expect(code(resent.outcome)).toBe("ok");
    expect(code(resendInvitation(resent.state, actor(state, admin), pending, NOW + 10_000).outcome)).toBe("INVITATION_COOLDOWN");
    expect(canResendAt(actor(resent.state, pending), NOW + 61_000)).toBeNull();
    expect(code(resendInvitation(state, actor(state, admin), "emp-12", NOW).outcome)).toBe("EMAIL_UNDELIVERABLE");
    expect(code(changeEmail(state, actor(state, admin), "emp-12", "iperez@aecon.cl", NOW).outcome)).toBe("ok");
  });
  it("revokes pending employees and deactivates, reactivates or deletes the active ones", () => {
    const state = seed();
    expect(code(deactivateEmployee(state, actor(state, admin), "emp-10", "", NOW).outcome)).toBe("EMPLOYEE_PENDING_USE_REVOKE");
    expect(revokeInvitation(state, actor(state, admin), "emp-10").state.employees).toHaveLength(state.employees.length - 1);
    expect(code(reactivateEmployee(state, actor(state, admin), "emp-6").outcome)).toBe("ok");
    expect(code(deleteEmployee(state, actor(state, admin), "emp-5", "").outcome)).toBe("ok");
  });
});

describe("invitation page", () => {
  it("inspects and accepts a valid link, opening the session", () => {
    const state = seed();
    const preview = inspectInvitation(state, "demo-camila-10", NOW);
    expect(preview.outcome.ok && preview.outcome.data.email).toBe("ctorres@aecon.cl");
    const versions = { termsVersion: "2026-10", privacyVersion: "2026-10" };
    expect(code(acceptInvitation(state, { token: "demo-camila-10", password: "Camila#2026x", ...versions }, NOW).outcome)).toBe("400");
    expect(code(acceptInvitation(state, { token: "demo-camila-10", password: "Obra#Norte27", termsVersion: "2025-01", privacyVersion: "2026-10" }, NOW).outcome)).toBe("TERMS_VERSION_MISMATCH");
    const accepted = acceptInvitation(state, { token: "demo-camila-10", password: "Obra#Norte27", ...versions }, NOW);
    expect(code(accepted.outcome)).toBe("ok");
    expect(accepted.state.sessionId).toBe("emp-10");
    expect(code(inspectInvitation(accepted.state, "demo-camila-10", NOW).outcome)).toBe("INVITATION_ALREADY_ACCEPTED");
  });
  it("refuses expired and unknown links", () => {
    const state = seed();
    expect(code(inspectInvitation(state, "demo-felipe-11", NOW).outcome)).toBe("INVITATION_EXPIRED");
    expect(code(inspectInvitation(state, "nope", NOW).outcome)).toBe("INVITATION_INVALID");
  });
});

