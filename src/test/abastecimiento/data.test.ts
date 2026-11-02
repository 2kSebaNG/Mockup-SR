import { normalizeRut } from "@/lib/access";
import { currentTaxRates, listBusinessUnits, listClients, listProjects, projectListItem, seedProcurement } from "@/lib/abastecimiento/data";

describe("the Abastecimiento sample", () => {
  const state = seedProcurement();

  it("points only at things that exist", () => {
    const accounts = new Set(state.chartAccounts.map(account => account.id));
    expect(state.chartAccounts.every(account => account.parentAccountId === null || accounts.has(account.parentAccountId))).toBe(true);
    expect(state.deals.every(deal => state.clients.some(client => client.id === deal.clientId))).toBe(true);
    expect(state.projects.every(project => state.deals.some(deal => deal.id === project.dealId))).toBe(true);
    expect(accounts.has(state.company.payrollChartAccountId!)).toBe(true);
  });

  it("has valid RUTs", () => {
    const ruts = [state.company.taxId, ...state.clients.map(client => client.taxId), ...state.people.map(person => person.taxId)];
    expect(ruts.every(rut => rut !== null && normalizeRut(rut) === rut)).toBe(true);
  });

  it("lists the inactive only when asked", () => {
    expect(listBusinessUnits(state).every(unit => unit.active)).toBe(true);
    expect(listBusinessUnits(state, true)).toHaveLength(state.businessUnits.length);
    expect(listClients(state).some(client => !client.active)).toBe(false);
  });

  it("answers the rate in force on a day", () => {
    expect(currentTaxRates(state, "2026-11-02")).toEqual({ date: "2026-11-02", iva: 19, honorariosRetention: 15.25 });
    expect(currentTaxRates(state, "2025-06-30").honorariosRetention).toBe(14.5);
    expect(currentTaxRates(state, "2010-01-01")).toEqual({ date: "2010-01-01", iva: null, honorariosRetention: null });
  });

  it("joins a project with its deal, client and unit", () => {
    expect(listProjects(state).map(project => project.code)).toEqual([...listProjects(state).map(project => project.code)].sort());
    expect(projectListItem(state, state.projects[0]!)).toMatchObject({ dealCode: "MLA2603", clientName: "Minera Los Andes", businessUnitName: "Ejecución" });
  });
});
