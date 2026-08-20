import { useSyncExternalStore } from "react";
import type { TemplateSpec } from "./types";
import { BASE_TEMPLATES } from "./library";

const KEY = "template-lab:v1";

interface State {
  generated: TemplateSpec[];
  saved: string[];
}

let state: State = { generated: [], saved: [] };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...state, ...(JSON.parse(raw) as State) };
  } catch {
    /* ignore */
  }
}

function commit(next: State) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

const emptySnapshot: State = { generated: [], saved: [] };

export function useTemplateStore() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => emptySnapshot,
  );
}

export function addGenerated(specs: TemplateSpec[]) {
  hydrate();
  const ids = new Set(specs.map((s) => s.id));
  commit({
    ...state,
    generated: [...specs, ...state.generated.filter((s) => !ids.has(s.id))].slice(0, 60),
  });
}

export function toggleSaved(id: string) {
  hydrate();
  const saved = state.saved.includes(id)
    ? state.saved.filter((s) => s !== id)
    : [...state.saved, id];
  commit({ ...state, saved });
}

export function allTemplates(): TemplateSpec[] {
  hydrate();
  return [...state.generated, ...BASE_TEMPLATES];
}

export function findTemplate(id: string): TemplateSpec | undefined {
  return allTemplates().find((t) => t.id === id);
}