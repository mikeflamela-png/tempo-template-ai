import type { OverlayType } from "@/lib/template/types";
import type { ShotType } from "@/lib/footage/types";
import { SIMPLE_STYLES } from "@/lib/template/simplestyles";

/**
 * EDITING RECIPES
 *
 * A style is just a set of rules for how to lay footage against music. They
 * reuse the existing template vocabulary (layouts, textures) and
 * the Simple Style presets already in the app.
 */
export interface EditRecipe {
  key: string;
  name: string;
  blurb: string;
  /** Simple Style this maps onto for palette / style pack lineage */
  simpleStyleKey: string;
  /** average shot length in seconds at 15s total */
  avgShot: number;
  /** 0 = even, 1 = strong accelerate towards the end */
  accelerate: number;
  /** 0 = ignore music, 1 = every cut on a beat */
  beatSync: number;
  /** preferred shot type running order, cycled and stretched to fit */
  sequence: ShotType[];
  /** how many shots Tempo likes to stay inside one scene before moving on */
  sceneRun: number;
  overlays: OverlayType[];
  /** chance a shot uses a non-full layout */
  layoutChance: number;
  /** ending shot gets this multiplier of length */
  endingHold: number;
  custom?: boolean;
}

export const BUILT_IN_RECIPES: EditRecipe[] = [
  {
    key: "clean",
    name: "Clean",
    blurb: "Even pacing, clean hard cuts, footage front and centre.",
    simpleStyleKey: "clean",
    avgShot: 1.5,
    accelerate: 0.15,
    beatSync: 0.55,
    sequence: ["hero", "product", "detail", "lifestyle", "product", "detail"],
    sceneRun: 2,
    overlays: ["vignette"],
    layoutChance: 0.05,
    endingHold: 1.35,
  },
  {
    key: "editorial",
    name: "Editorial",
    blurb: "Irregular rhythm, framed shots, considered holds.",
    simpleStyleKey: "editorial",
    avgShot: 1.8,
    accelerate: 0.25,
    beatSync: 0.4,
    sequence: ["environment", "detail", "hero", "lifestyle", "detail", "product"],
    sceneRun: 3,
    overlays: ["frame_line", "grain", "paper"],
    layoutChance: 0.22,
    endingHold: 1.5,
  },
  {
    key: "fast_product",
    name: "Fast Product",
    blurb: "Rapid hard cuts, product every few frames.",
    simpleStyleKey: "high_energy",
    avgShot: 0.75,
    accelerate: 0.45,
    beatSync: 0.85,
    sequence: ["hero", "product", "detail", "action", "product", "lifestyle", "detail", "hero"],
    sceneRun: 2,
    overlays: ["flash", "chromatic"],
    layoutChance: 0.14,
    endingHold: 1.1,
  },
  {
    key: "film",
    name: "Film",
    blurb: "Longer holds, analog texture, cuts that breathe.",
    simpleStyleKey: "filmic",
    avgShot: 2.2,
    accelerate: 0.2,
    beatSync: 0.35,
    sequence: ["environment", "lifestyle", "detail", "lifestyle", "action", "hero"],
    sceneRun: 3,
    overlays: ["grain", "halation", "light_leak", "film_border"],
    layoutChance: 0.05,
    endingHold: 1.7,
  },
  {
    key: "nineties",
    name: "90s",
    blurb: "Camcorder texture, splices, timestamp, raw energy.",
    simpleStyleKey: "raw_social",
    avgShot: 1.2,
    accelerate: 0.3,
    beatSync: 0.6,
    sequence: ["action", "lifestyle", "detail", "environment", "hero", "action"],
    sceneRun: 2,
    overlays: ["camcorder", "timestamp", "noise", "grain"],
    layoutChance: 0.08,
    endingHold: 1.2,
  },
  {
    key: "lifestyle",
    name: "Lifestyle",
    blurb: "Warm build, people and place, soft momentum.",
    simpleStyleKey: "luxury",
    avgShot: 1.7,
    accelerate: 0.3,
    beatSync: 0.5,
    sequence: ["lifestyle", "environment", "detail", "action", "lifestyle", "hero"],
    sceneRun: 3,
    overlays: ["vignette", "bloom"],
    layoutChance: 0.1,
    endingHold: 1.5,
  },
];

const CUSTOM_KEY = "tempo-saved-styles:v1";

export function savedRecipes(): EditRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as EditRecipe[]) : [];
  } catch {
    return [];
  }
}

export function saveRecipe(recipe: EditRecipe) {
  if (typeof window === "undefined") return;
  const list = savedRecipes().filter((r) => r.key !== recipe.key);
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify([{ ...recipe, custom: true }, ...list]));
}

export function deleteSavedRecipe(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CUSTOM_KEY,
    JSON.stringify(savedRecipes().filter((r) => r.key !== key)),
  );
}

export function allRecipes(): EditRecipe[] {
  return [...BUILT_IN_RECIPES, ...savedRecipes()];
}

export function recipeByKey(key: string): EditRecipe {
  return allRecipes().find((r) => r.key === key) ?? BUILT_IN_RECIPES[0]!;
}

export function simpleStyleFor(recipe: EditRecipe) {
  return SIMPLE_STYLES.find((s) => s.key === recipe.simpleStyleKey) ?? SIMPLE_STYLES[0]!;
}
