import { useSyncExternalStore } from "react";
import { seedAccess, type AccessState, type Outcome, type Step } from "./access";

// Until the screens call the Human360 API, the access data lives in this browser (localStorage, shared by its tabs)
// and starts from the sample in `seedAccess`. Calls wait a moment like a request would, so the screens show their
// busy states. The server renders the sample without a session; the browser then shows its own state.

const KEY = "ecosistema-x.access.v2";
const LATENCY = 350;

const serverState = seedAccess(Date.parse("2026-10-29T12:00:00Z"));
let state: AccessState | null = null;
const listeners = new Set<() => void>();

function read(): AccessState {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as AccessState;
  } catch { /* storage blocked or corrupt: start from the sample */ }
  return seedAccess();
}
function current(): AccessState {
  if (state === null) state = read();
  return state;
}
function write(next: AccessState) {
  state = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* keeps working in memory */ }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab logged in or out, or changed the data.
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) { state = null; listener(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function useAccess(): AccessState {
  return useSyncExternalStore(subscribe, current, () => serverState);
}

/** False while hydrating: the session is only known in the browser. */
export function useAccessReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Runs an operation as a request: waits, applies the next state and returns the outcome. */
export async function call<T>(operation: (state: AccessState) => Step<T>): Promise<Outcome<T>> {
  await new Promise(resolve => setTimeout(resolve, LATENCY));
  const step = operation(current());
  if (step.state !== current()) write(step.state);
  return step.outcome;
}

/** Back to the sample data (and no session). */
export function resetAccess() {
  write(seedAccess());
}
