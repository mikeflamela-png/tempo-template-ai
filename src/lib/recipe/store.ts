/**
 * Recipe persistence + version lineage.
 *
 * The working recipe autosaves. Every generated edit is recorded as a version
 * with a parent, so branching from an edit produces a real tree you can walk
 * back up.
 */
import { useSyncExternalStore } from "react";
import type { TemplateSpec } from "@/lib/template/types";
import { newRecipe, type CreativeRecipe, type SectionKey } from "./types";

const KEY = "tempo:recipe:v1";

export interface VersionRecord {
  id: string;
  specId: string;
  name: string;
  label: string;
  description: string;
  parentId: string | null;
  recipeId: string;
  seed: number;
  changed: SectionKey[];
  createdAt: number;
  spec: TemplateSpec;
}

interface State {
  recipe: CreativeRecipe;
  saved: CreativeRecipe[];
  versions: VersionRecord[];
}

const empty: State = { recipe: newRecipe("recipe-default"), saved: [], versions: [] };
let state: State = { ...empty };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      state = {
        recipe: { ...newRecipe(parsed.recipe?.id), ...parsed.recipe },
        saved: parsed.saved ?? [],
        versions: parsed.versions ?? [],
      };
    }
  } catch {
    /* ignore */
  }
}

function commit(next: State) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          recipe: state.recipe,
          saved: state.saved,
          versions: state.versions.slice(0, 60),
        }),
      );
    } catch {
      /* quota — keep memory state */
    }
  }
  listeners.forEach((l) => l());
}

export function useRecipeStore() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}

export function getRecipe() {
  hydrate();
  return state.recipe;
}

export function updateRecipe(patch: Partial<CreativeRecipe>) {
  hydrate();
  commit({ ...state, recipe: { ...state.recipe, ...patch, updatedAt: Date.now() } });
}

export function patchSection<K extends SectionKey>(
  key: K,
  patch: Partial<CreativeRecipe[K]>,
) {
  hydrate();
  const section = { ...state.recipe[key], ...patch } as CreativeRecipe[K];
  commit({
    ...state,
    recipe: { ...state.recipe, [key]: section, updatedAt: Date.now() } as CreativeRecipe,
  });
}

export function patchSectionValue<K extends SectionKey>(
  key: K,
  patch: Partial<CreativeRecipe[K]["value"]>,
) {
  hydrate();
  const current = state.recipe[key];
  const section = {
    ...current,
    state: current.state === "custom" ? current.state : "custom",
    value: { ...current.value, ...patch },
  } as CreativeRecipe[K];
  commit({
    ...state,
    recipe: { ...state.recipe, [key]: section, updatedAt: Date.now() } as CreativeRecipe,
  });
}

export function resetRecipe() {
  hydrate();
  commit({ ...state, recipe: newRecipe() });
}

export function saveRecipeAs(name: string) {
  hydrate();
  const copy: CreativeRecipe = {
    ...state.recipe,
    id: `recipe-${Date.now().toString(36)}`,
    name,
    updatedAt: Date.now(),
  };
  commit({ ...state, saved: [copy, ...state.saved].slice(0, 30) });
  return copy;
}

export function loadRecipe(id: string) {
  hydrate();
  const found = state.saved.find((r) => r.id === id);
  if (found) commit({ ...state, recipe: { ...found } });
}

export function deleteSavedRecipe(id: string) {
  hydrate();
  commit({ ...state, saved: state.saved.filter((r) => r.id !== id) });
}

export function recordVersions(records: Omit<VersionRecord, "id" | "createdAt">[]) {
  hydrate();
  const rows: VersionRecord[] = records.map((r, i) => ({
    ...r,
    id: `v-${Date.now().toString(36)}-${i}`,
    createdAt: Date.now(),
  }));
  commit({ ...state, versions: [...rows, ...state.versions].slice(0, 120) });
  return rows;
}

export function versionForSpec(specId: string) {
  hydrate();
  return state.versions.find((v) => v.specId === specId) ?? null;
}

export function lineageOf(specId: string): VersionRecord[] {
  hydrate();
  const chain: VersionRecord[] = [];
  let cur = state.versions.find((v) => v.specId === specId) ?? null;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? state.versions.find((v) => v.id === cur!.parentId) ?? null : null;
  }
  return chain;
}

export function childrenOf(versionId: string) {
  hydrate();
  return state.versions.filter((v) => v.parentId === versionId);
}
