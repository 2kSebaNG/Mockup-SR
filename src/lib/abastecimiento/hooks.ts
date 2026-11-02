import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { currentTaxRates, listBusinessUnits, listChartAccounts, listClients, listDeals, listPeople, listProjects, listTaxRates, projectListItem } from "./data";
import { onProcurementChange, request } from "./store";

// The data hooks of budget-control-web (lib/api/use-*.ts) with the same names, query keys and answers, over the local
// store. Porting a page keeps its calls as they are; going to the real API later is only replacing each `queryFn`
// with its `openapi-fetch` request (the original files have them).

/** Refetches what is on screen when the data changes, here or in another tab. */
function useProcurementSync() {
  const queryClient = useQueryClient();
  useEffect(() => onProcurementChange(() => { void queryClient.invalidateQueries(); }), [queryClient]);
}

export function useBusinessUnits(includeInactive = false) {
  useProcurementSync();
  return useQuery({ queryKey: ["business-units", { includeInactive }], queryFn: () => request(state => listBusinessUnits(state, includeInactive)) });
}

export function useChartAccounts() {
  useProcurementSync();
  return useQuery({ queryKey: ["chart-accounts"], queryFn: () => request(listChartAccounts) });
}

export function useTaxRates() {
  useProcurementSync();
  return useQuery({ queryKey: ["tax-rates"], queryFn: () => request(listTaxRates) });
}

/** The rates in force on a day (today by default). */
export function useCurrentTaxRates(date?: string) {
  useProcurementSync();
  const day = date ?? new Date().toISOString().slice(0, 10);
  return useQuery({ queryKey: ["tax-rates", "current", date ?? "today"], queryFn: () => request(state => currentTaxRates(state, day)) });
}

export function useCompany() {
  useProcurementSync();
  return useQuery({ queryKey: ["company"], queryFn: () => request(state => state.company) });
}

export function useClients(includeInactive = false) {
  useProcurementSync();
  return useQuery({ queryKey: ["clients", includeInactive], queryFn: () => request(state => listClients(state, includeInactive)) });
}

export function useDeals() {
  useProcurementSync();
  return useQuery({ queryKey: ["deals"], queryFn: () => request(listDeals) });
}

export function useProjects() {
  useProcurementSync();
  return useQuery({ queryKey: ["projects"], queryFn: () => request(listProjects) });
}

/** Every project with its deal, client and unit (what GET /projects/page lists, unpaged until phase 3). */
export function useProjectItems() {
  useProcurementSync();
  return useQuery({ queryKey: ["projects", "items"], queryFn: () => request(state => state.projects.map(project => projectListItem(state, project))) });
}

export function usePeople() {
  useProcurementSync();
  return useQuery({ queryKey: ["people"], queryFn: () => request(listPeople) });
}
