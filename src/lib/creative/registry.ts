/**
 * TECHNIQUE + RECIPE LIBRARY
 *
 * Techniques = kernel + parameters (an executable 0.25–4s moment).
 * Recipes    = ordered technique instances (a multi-step sequence).
 * The library grows: everything invented in the Lab is saved here and becomes
 * available to the generator, which feeds usage stats back in.
 */
import { useSyncExternalStore } from "react";
import { KERNELS, defaultParams, type Params } from "./kernels";

export type TechniqueOrigin = "builtin" | "invented" | "mutation" | "combination";

export interface Technique {
  id: string;
  name: string;
  kernel: string;
  params: Params;
  duration: number;
  tags: string[];
  origin: TechniqueOrigin;
  note?: string;
  parents?: string[];
  createdAt: number;
  uses: number;
  favorite?: boolean;
}

export interface RecipeStep {
  techniqueId: string;
  offset: number;
  duration?: number;
}

export interface Recipe {
  id: string;
  name: string;
  note?: string;
  steps: RecipeStep[];
  duration: number;
  origin: TechniqueOrigin;
  createdAt: number;
  uses: number;
}

interface LibState {
  techniques: Technique[];
  recipes: Recipe[];
  /** tag -> taste weight, nudged by saves and uses */
  taste: Record<string, number>;
}

const KEY = "tempo.creative.library.v1";

function seedTechniques(): Technique[] {
  const out: Technique[] = [];
  KERNELS.forEach((k, i) => {
    out.push({
      id: `builtin-${k.id}`,
      name: k.name,
      kernel: k.id,
      params: defaultParams(k.id),
      duration: k.defaultDuration,
      tags: k.tags,
      origin: "builtin",
      note: k.blurb,
      createdAt: 0,
      uses: 0,
    });
    void i;
  });
  return out;
}

function seedRecipes(t: Technique[]): Recipe[] {
  const id = (k: string) => t.find((x) => x.kernel === k)?.id ?? t[0]!.id;
  return [
    {
      id: "recipe-tear-reveal",
      name: "Tear → freeze → mark",
      note: "Rip into a held frame, then annotate the detail by hand.",
      steps: [
        { techniqueId: id("paper_rip"), offset: 0 },
        { techniqueId: id("freeze_annotation"), offset: 0.55, duration: 1.1 },
        { techniqueId: id("marker_circle"), offset: 0.9, duration: 0.9 },
      ],
      duration: 2.1,
      origin: "builtin",
      createdAt: 0,
      uses: 0,
    },
    {
      id: "recipe-burn-strip",
      name: "Burn → strip rush → numbers",
      note: "Analog burn hands off to a rushing strip, indexed like a contact sheet.",
      steps: [
        { techniqueId: id("film_burn"), offset: 0 },
        { techniqueId: id("film_strip_rush"), offset: 0.45, duration: 0.9 },
        { techniqueId: id("editorial_numbers"), offset: 1.1, duration: 1 },
      ],
      duration: 2.2,
      origin: "builtin",
      createdAt: 0,
      uses: 0,
    },
    {
      id: "recipe-type-slam",
      name: "Shutter → type crash → echo",
      note: "Paparazzi burst, word slams, frame smears out of it.",
      steps: [
        { techniqueId: id("shutter_sequence"), offset: 0 },
        { techniqueId: id("type_crash"), offset: 0.5, duration: 0.7 },
        { techniqueId: id("frame_echo"), offset: 1.05, duration: 0.6 },
      ],
      duration: 1.7,
      origin: "builtin",
      createdAt: 0,
      uses: 0,
    },
  ];
}

const seedT = seedTechniques();
const empty: LibState = { techniques: seedT, recipes: seedRecipes(seedT), taste: {} };
let state: LibState = empty;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LibState>;
      const userT = (parsed.techniques ?? []).filter((t) => t.origin !== "builtin");
      state = {
        techniques: [...seedT, ...userT],
        recipes: [
          ...seedRecipes(seedT),
          ...(parsed.recipes ?? []).filter((r) => r.origin !== "builtin"),
        ],
        taste: parsed.taste ?? {},
      };
    }
  } catch {
    /* ignore */
  }
}

function commit(next: LibState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          techniques: state.techniques.filter((t) => t.origin !== "builtin"),
          recipes: state.recipes.filter((r) => r.origin !== "builtin"),
          taste: state.taste,
        }),
      );
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function useCreativeLibrary() {
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

export function allTechniques() {
  hydrate();
  return state.techniques;
}

export function allRecipes() {
  hydrate();
  return state.recipes;
}

export function techniqueById(id: string) {
  hydrate();
  return state.techniques.find((t) => t.id === id);
}

function bumpTaste(tags: string[], amount: number) {
  const taste = { ...state.taste };
  tags.forEach((t) => (taste[t] = (taste[t] ?? 0) + amount));
  return taste;
}

export function saveTechnique(t: Omit<Technique, "id" | "createdAt" | "uses"> & { id?: string }) {
  hydrate();
  const id = t.id ?? `tech-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const technique: Technique = { ...t, id, createdAt: Date.now(), uses: 0 };
  commit({
    ...state,
    techniques: [...state.techniques.filter((x) => x.id !== id), technique],
    taste: bumpTaste(technique.tags, 1.5),
  });
  return technique;
}

export function saveRecipe(r: Omit<Recipe, "id" | "createdAt" | "uses"> & { id?: string }) {
  hydrate();
  const id = r.id ?? `recipe-${Date.now().toString(36)}`;
  const recipe: Recipe = { ...r, id, createdAt: Date.now(), uses: 0 };
  commit({ ...state, recipes: [...state.recipes.filter((x) => x.id !== id), recipe] });
  return recipe;
}

export function deleteTechnique(id: string) {
  hydrate();
  commit({ ...state, techniques: state.techniques.filter((t) => t.id !== id) });
}

export function deleteRecipe(id: string) {
  hydrate();
  commit({ ...state, recipes: state.recipes.filter((r) => r.id !== id) });
}

export function toggleFavoriteTechnique(id: string) {
  hydrate();
  const t = state.techniques.find((x) => x.id === id);
  if (!t) return;
  commit({
    ...state,
    techniques: state.techniques.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x)),
    taste: bumpTaste(t.tags, t.favorite ? -1 : 2),
  });
}

export function recordTechniqueUse(ids: string[]) {
  hydrate();
  if (!ids.length) return;
  const set = new Set(ids);
  commit({
    ...state,
    techniques: state.techniques.map((t) => (set.has(t.id) ? { ...t, uses: t.uses + 1 } : t)),
  });
}

/** Taste-weighted score used by the generator when picking techniques. */
export function tasteScore(tags: string[]) {
  hydrate();
  return tags.reduce((acc, t) => acc + (state.taste[t] ?? 0), 0);
}

export function tasteProfile() {
  hydrate();
  return Object.entries(state.taste)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}
