/**
 * CREATIVE TASTE PROFILE
 *
 * The one persistent model of "what this user likes". It blends signal from
 * gold standard reference videos, structured love/dislike feedback, and
 * lightweight implicit signals (favorited assets, kept/removed motion picks,
 * saved openers, chosen type systems). Two sliders — gold standard influence
 * and taste influence — control how strongly this profile should steer
 * ranking and generation versus leaving room for exploration.
 */
import { useSyncExternalStore } from "react";
import { aggregateSignals, type GoldSignals, type LikeTag } from "./goldStandards";

export type DislikeTag =
  | "Too AI-looking"
  | "Too Geometric"
  | "Too Busy"
  | "Too Boring"
  | "Cheesy"
  | "Bad Typography"
  | "Bad Pacing"
  | "Too Many Effects"
  | "Weak Graphics"
  | "Weak Opening"
  | "Weak Ending"
  | "Product Gets Lost"
  | "Not On Brand";

export const DISLIKE_TAGS: DislikeTag[] = [
  "Too AI-looking",
  "Too Geometric",
  "Too Busy",
  "Too Boring",
  "Cheesy",
  "Bad Typography",
  "Bad Pacing",
  "Too Many Effects",
  "Weak Graphics",
  "Weak Opening",
  "Weak Ending",
  "Product Gets Lost",
  "Not On Brand",
];

export interface FeedbackEntry {
  id: string;
  targetId: string;
  kind: "love" | "dislike";
  tags: string[];
  note?: string;
  createdAt: number;
}

export type SignalKind =
  | "favorite"
  | "select"
  | "reject"
  | "motion-kept"
  | "motion-removed"
  | "opener-saved"
  | "type-system-picked";

export interface SignalEntry {
  id: string;
  kind: SignalKind;
  payload: Record<string, unknown>;
  createdAt: number;
}

interface TasteState {
  feedback: FeedbackEntry[];
  signals: SignalEntry[];
  goldInfluence: number; // 0..1
  tasteInfluence: number; // 0..1
}

const KEY = "tempo.taste.profile.v1";
const empty: TasteState = { feedback: [], signals: [], goldInfluence: 0.6, tasteInfluence: 0.75 };
let state: TasteState = empty;
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function commit(next: TasteState) {
  state = next;
  persist();
  notify();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as TasteState) };
  } catch {
    /* ignore */
  }
}

export function useTasteProfile() {
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

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

export function recordFeedback(input: { targetId: string; kind: "love" | "dislike"; tags: string[]; note?: string }) {
  hydrate();
  const entry: FeedbackEntry = { id: uid("fb"), createdAt: Date.now(), ...input };
  commit({ ...state, feedback: [entry, ...state.feedback] });
  return entry;
}

export function recordSignal(kind: SignalKind, payload: Record<string, unknown> = {}) {
  hydrate();
  const entry: SignalEntry = { id: uid("sig"), kind, payload, createdAt: Date.now() };
  commit({ ...state, signals: [entry, ...state.signals] });
  return entry;
}

export function setTasteInfluence(value: number) {
  hydrate();
  commit({ ...state, tasteInfluence: Math.max(0, Math.min(1, value)) });
}

export function setGoldInfluence(value: number) {
  hydrate();
  commit({ ...state, goldInfluence: Math.max(0, Math.min(1, value)) });
}

export interface TasteWeights {
  pacing: number; // 0-1, higher = faster preferred
  typographyDensity: number; // 0-1
  effectDensity: number; // 0-1
  transitionFrequency: number; // 0-1
  motionAmount: number; // 0-1
  filmTexture: number; // 0-1
  restraint: number; // 0-1, higher = prefers minimal/restrained work
  geometryPenalty: number; // 0-1, higher = penalize "too geometric" harder
  aiLookPenalty: number; // 0-1
  busyPenalty: number; // 0-1
  productFocus: number; // 0-1
}

const DEFAULT_WEIGHTS: TasteWeights = {
  pacing: 0.5,
  typographyDensity: 0.5,
  effectDensity: 0.5,
  transitionFrequency: 0.5,
  motionAmount: 0.5,
  filmTexture: 0.3,
  restraint: 0.5,
  geometryPenalty: 0.2,
  aiLookPenalty: 0.3,
  busyPenalty: 0.3,
  productFocus: 0.5,
}

/** Turns gold standard signals into a 0-1 weight fingerprint. */
function weightsFromGoldSignals(signals: GoldSignals): TasteWeights {
  return {
    pacing: clamp01(1 - signals.shotDurationMedian / 3),
    typographyDensity: clamp01(signals.textFrequencyProxy),
    effectDensity: clamp01(signals.effectDensityProxy),
    transitionFrequency: clamp01(signals.cutFrequency / 3),
    motionAmount: clamp01(signals.motionAmount),
    filmTexture: clamp01(signals.filmTextureAmount),
    restraint: clamp01(1 - signals.effectDensityProxy),
    geometryPenalty: 0.2,
    aiLookPenalty: 0.3,
    busyPenalty: clamp01(signals.effectDensityProxy),
    productFocus: 0.5,
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

const LOVE_ADJUST: Partial<Record<LikeTag, Partial<TasteWeights>>> = {
  pacing: { pacing: 0.08, transitionFrequency: 0.05 },
  typography: { typographyDensity: 0.08 },
  motion: { motionAmount: 0.08 },
  graphics: { effectDensity: 0.06 },
  "film treatment": { filmTexture: 0.1 },
  restraint: { restraint: 0.1, busyPenalty: 0.05 },
  "product treatment": { productFocus: 0.1 },
};

const DISLIKE_ADJUST: Partial<Record<DislikeTag, Partial<TasteWeights>>> = {
  "Too AI-looking": { aiLookPenalty: 0.15 },
  "Too Geometric": { geometryPenalty: 0.15 },
  "Too Busy": { busyPenalty: 0.15, effectDensity: -0.1 },
  "Too Boring": { pacing: 0.08, motionAmount: 0.05 },
  "Bad Pacing": { pacing: -0.05 },
  "Too Many Effects": { effectDensity: -0.15, restraint: 0.1 },
  "Product Gets Lost": { productFocus: 0.15 },
};

/** Numeric taste preferences blended from gold signals + structured feedback. */
export function tasteWeights(): TasteWeights {
  hydrate();
  const gold = aggregateSignals();
  let w: TasteWeights = gold
    ? blend(DEFAULT_WEIGHTS, weightsFromGoldSignals(gold), state.goldInfluence)
    : { ...DEFAULT_WEIGHTS };

  for (const fb of state.feedback) {
    const table = fb.kind === "love" ? LOVE_ADJUST : DISLIKE_ADJUST;
    for (const tag of fb.tags) {
      const adjust = (table as Record<string, Partial<TasteWeights>>)[tag];
      if (!adjust) continue;
      for (const [k, v] of Object.entries(adjust)) {
        const key = k as keyof TasteWeights;
        w = { ...w, [key]: clamp01(w[key] + (v ?? 0)) };
      }
    }
  }
  return w;
}

function blend(a: TasteWeights, b: TasteWeights, t: number): TasteWeights {
  const out = { ...a };
  (Object.keys(a) as (keyof TasteWeights)[]).forEach((k) => {
    out[k] = clamp01(a[k] * (1 - t) + b[k] * t);
  });
  return out;
}

/** Seeded PRNG so exploration is reproducible per render. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ranks items by alignment with taste weights, blended with the taste
 * influence slider: `tasteInfluence` fraction is a strict taste-aligned sort,
 * `1 - tasteInfluence` fraction is randomized exploration (default ~75/25).
 */
export function rankByTaste<T>(
  items: T[],
  featurizer: (item: T, weights: TasteWeights) => number,
  rng: number | (() => number) = Date.now(),
): T[] {
  hydrate();
  const weights = tasteWeights();
  const rand = typeof rng === "function" ? rng : mulberry32(rng);
  const influence = state.tasteInfluence;

  const scored = items.map((item) => ({
    item,
    score: featurizer(item, weights) * influence + rand() * (1 - influence),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

export interface GenerationTargets {
  targetShotLength: number; // seconds
  maxEffectsPer10s: number;
  textFrequency: number; // 0-1
  transitionFrequency: number; // 0-1
  motionAmount: number; // 0-1
  filmTexture: number; // 0-1
  restraint: number; // 0-1
}

/** Turns current taste weights into soft generation constraints. */
export function applyTasteToTargets(baseTargets: Partial<GenerationTargets> = {}): GenerationTargets {
  const w = tasteWeights();
  const base: GenerationTargets = {
    targetShotLength: 1.6,
    maxEffectsPer10s: 6,
    textFrequency: 0.5,
    transitionFrequency: 0.5,
    motionAmount: 0.5,
    filmTexture: 0.3,
    restraint: 0.5,
    ...baseTargets,
  };
  return {
    targetShotLength: clampRange(base.targetShotLength * (1.6 - w.pacing * 1.1), 0.3, 4),
    maxEffectsPer10s: Math.round(clampRange(base.maxEffectsPer10s * (0.5 + w.effectDensity) * (1 - w.restraint * 0.4), 1, 14)),
    textFrequency: clamp01(base.textFrequency * (0.4 + w.typographyDensity)),
    transitionFrequency: clamp01(base.transitionFrequency * (0.4 + w.transitionFrequency)),
    motionAmount: clamp01(base.motionAmount * (0.4 + w.motionAmount)),
    filmTexture: clamp01(base.filmTexture * (0.4 + w.filmTexture)),
    restraint: clamp01(w.restraint),
  };
}

function clampRange(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
