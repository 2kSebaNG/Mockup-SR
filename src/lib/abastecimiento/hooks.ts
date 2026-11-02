import { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import type { components } from "./api/schema";
import {
  createBusinessUnit, createChartAccount, createClient, createTaxRate, createVendor, createVendorCategory, deleteTaxRate, deleteVendorCategory,
  renameVendorCategory, suggestClientSigla, updateBusinessUnit, updateChartAccount, updateClient, updateCompany, updateTaxRate, updateVendor, type CompanyPatch,
} from "./admin";
import {
  currentTaxRates, listBusinessUnits, listChartAccounts, listClients, listDeals, listKindConflicts, listPeople, listProjects, listTaxRates, listVendorCatalog,
  listVendorCategories, listVendorsForExport, projectListItem, vendorMetrics, type ProcurementState, type VendorFilter, type VendorListParams, type VendorMetricsParams,
} from "./data";
import { vendorsCsv } from "./vendor-export";
import { mutate, onProcurementChange, request } from "./store";

type Schemas = components["schemas"];

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

/** `enabled` lets a screen skip it for whoever cannot read deals (the clients screen, without sales:read). */
export function useDeals(enabled = true) {
  useProcurementSync();
  return useQuery({ queryKey: ["deals"], queryFn: () => request(listDeals), enabled });
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

// --- Writes ----------------------------------------------------------------------------------------------------

/**
 * A change through the local store, as the source's mutation hooks: refreshes the lists it touches and says it worked
 * (the source did it from `meta.successMessage`). A refusal keeps the API's message in the thrown error, for
 * `apiErrorText`.
 */
function useChange<Input, Output>(change: (state: ProcurementState, input: Input) => { state: ProcurementState; data: Output }, invalidate: QueryKey[], success?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => mutate(state => change(state, input)),
    onSuccess: () => {
      invalidate.forEach(queryKey => void queryClient.invalidateQueries({ queryKey }));
      if (success) toast.success(success);
    },
  });
}

export const useCreateBusinessUnit = () => useChange((state, body: { name: string; description?: string | undefined }) => createBusinessUnit(state, body), [["business-units"]], "Unidad de negocio creada.");
export const useUpdateBusinessUnit = () =>
  useChange((state, { id, ...body }: { id: string; name?: string; description?: string | null; active?: boolean }) => updateBusinessUnit(state, id, body), [["business-units"]], "Unidad de negocio guardada.");

/** The accounts whose kind does not match what is booked to them; `enabled` skips it for who cannot manage the chart. */
export function useKindConflicts(enabled = true) {
  useProcurementSync();
  return useQuery({ queryKey: ["kind-conflicts"], queryFn: () => request(listKindConflicts), enabled });
}
export const useCreateChartAccount = () =>
  useChange((state, body: { name: string; parentAccountId?: string | undefined }) => createChartAccount(state, body), [["chart-accounts"]], "Cuenta contable creada.");
/** Renames, changes the kind or moves an account (a move reassigns its code and its sub-accounts'). */
export const useUpdateChartAccount = () =>
  useChange((state, { id, ...body }: { id: string; name?: string; parentAccountId?: string | null; position?: number; kind?: "INCOME" | "COST" }) => updateChartAccount(state, id, body),
    [["chart-accounts"], ["kind-conflicts"], ["project-alerts"], ["project-detail"], ["portfolio"]], "Cuenta contable guardada.");

export const useCreateTaxRate = () => useChange((state, body: Schemas["CreateTaxRateRequest"]) => createTaxRate(state, body), [["tax-rates"]], "Tasa agregada.");
export const useUpdateTaxRate = () => useChange((state, { id, ...body }: { id: string } & Schemas["UpdateTaxRateRequest"]) => updateTaxRate(state, id, body), [["tax-rates"]], "Tasa guardada.");
export const useDeleteTaxRate = () => useChange((state, id: string) => deleteTaxRate(state, id), [["tax-rates"]], "Tasa quitada.");

export const useUpdateCompany = () => useChange((state, body: CompanyPatch) => updateCompany(state, body), [["company"], ["project-alerts"]], "Perfil de la empresa actualizado.");

export const useCreateClient = () => useChange((state, body: Schemas["CreateClientRequest"]) => createClient(state, body), [["clients"]], "Cliente creado.");
export const useUpdateClient = () => useChange((state, { id, ...body }: { id: string } & Schemas["UpdateClientRequest"]) => updateClient(state, id, body), [["clients"]], "Cliente guardado.");
/** A candidate sigla for a client not saved yet. */
export function useSuggestClientSigla() {
  return useMutation({ mutationFn: (name: string) => request(state => suggestClientSigla(state, name)) });
}

// --- Vendors ---------------------------------------------------------------------------------------------------

/** One page of the vendor catalog (the management screen's list); the previous page stays while the next loads. */
export function useVendors(params: VendorListParams = {}) {
  useProcurementSync();
  return useQuery({ queryKey: ["vendors", "catalog", params], queryFn: () => request(state => listVendorCatalog(state, params)), placeholderData: keepPreviousData });
}

export function useVendorCategories() {
  useProcurementSync();
  return useQuery({ queryKey: ["vendors", "categories"], queryFn: () => request(listVendorCategories) });
}

/** How much each vendor was ordered and paid, and who is dearer or cheaper. */
export function useVendorMetrics(params: VendorMetricsParams = {}) {
  useProcurementSync();
  return useQuery({ queryKey: ["vendors", "metrics", params], queryFn: () => request(state => vendorMetrics(state, params)), placeholderData: keepPreviousData });
}

export const useCreateVendor = () => useChange((state, body: Schemas["CreateVendorRequest"]) => createVendor(state, body), [["vendors"]], "Proveedor creado.");
export const useUpdateVendor = () => useChange((state, { id, ...body }: { id: string } & Schemas["UpdateVendorRequest"]) => updateVendor(state, id, body), [["vendors"]], "Proveedor guardado.");
export const useCreateVendorCategory = () => useChange((state, name: string) => createVendorCategory(state, name), [["vendors"]], "Categoría agregada.");
export const useRenameVendorCategory = () => useChange((state, { id, name }: { id: string; name: string }) => renameVendorCategory(state, id, name), [["vendors"]], "Categoría renombrada.");
export const useDeleteVendorCategory = () => useChange((state, id: string) => deleteVendorCategory(state, id), [["vendors"]], "Categoría quitada.");

/**
 * The vendors the filters leave in (every page) and their metrics, as a file to download: handed back as a blob URL
 * the caller starts the download from and revokes. The API answers an .xlsx; until it is connected it is a CSV
 * that Excel opens.
 */
export function useExportVendors() {
  return useMutation({
    mutationFn: (filter: VendorFilter) =>
      request(state => URL.createObjectURL(new Blob([vendorsCsv(listVendorsForExport(state, filter), vendorMetrics(state, filter).vendors)], { type: "text/csv;charset=utf-8" }))),
  });
}
