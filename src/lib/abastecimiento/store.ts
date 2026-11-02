import { seedProcurement, type ProcurementState } from "./data";

// Until the screens call budget-control-api, its data lives in this browser (localStorage, shared by its tabs) and
// starts from `seedProcurement`. `request` and `mutate` wait a moment like a call would, so screens show their loading
// and busy states; the hooks in ./hooks.ts are the only callers.

const KEY = "ecosistema-x.abastecimiento.v1";
export const LATENCY = 300;

let state: ProcurementState | null = null;
const listeners = new Set<() => void>();

function read(): ProcurementState {
  if (typeof window === "undefined") return seedProcurement();
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as ProcurementState;
  } catch { /* storage blocked or corrupt: start from the sample */ }
  return seedProcurement();
}
const current = () => (state ??= read());

function write(next: ProcurementState) {
  state = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* keeps working in memory */ }
  listeners.forEach(listener => listener());
}

/** Called when the data changes here or in another tab. */
export function onProcurementChange(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) { state = null; listener(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY));

/** A read, as a request: waits, then answers from the current data. */
export async function request<T>(read: (state: ProcurementState) => T): Promise<T> {
  await wait();
  return read(current());
}

/** A change, as a request: waits, applies the next state and returns what the endpoint answers. */
export async function mutate<T>(change: (state: ProcurementState) => { state: ProcurementState; data: T }): Promise<T> {
  await wait();
  const result = change(current());
  if (result.state !== current()) write(result.state);
  return result.data;
}

/** Back to the sample data. */
export function resetProcurement() {
  write(seedProcurement());
}
