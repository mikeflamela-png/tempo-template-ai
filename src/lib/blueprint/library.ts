/**
 * BLUEPRINTS
 *
 * A blueprint is the *structure* of a good edit — the block order and the time
 * each block gets — separated from the look. The generator invents inside a
 * blueprint instead of inventing the shape of the video every time.
 */
import { useSyncExternalStore } from "react";
import type { Purpose, TemplateSpec, TextSlot } from "@/lib/template/types";

export type BlockKind =
  | "hook"
  | "shot"
  | "product"
  | "detail"
  | "proof"
  | "hold"
  | "text_beat"
  | "end_card";

export interface BlueprintBlock {
  kind: BlockKind;
  /** relative weight of the total duration */
  share: number;
  note?: string;
}

export interface MotionSlot {
  key: string;
  name: string;
  categories: string[];
  minDuration: number;
  maxDuration: number;
  intensity: number;
  optional: boolean;
  styleTags: string[];
  /** normalized 0-1 position along the timeline, if known */
  at?: number;
}

export interface Blueprint {
  id: string;
  name: string;
  blurb: string;
  source: "builtin" | "custom";
  blocks: BlueprintBlock[];
  bestFor: string[];
  /** semantic motion beats (opening accent, transition event, etc.) */
  motionSlots?: MotionSlot[];
}

const bp = (
  id: string,
  name: string,
  blurb: string,
  bestFor: string[],
  blocks: BlueprintBlock[],
  motionSlots?: MotionSlot[],
): Blueprint => ({ id, name, blurb, source: "builtin", blocks, bestFor, ...(motionSlots ? { motionSlots } : {}) });

const slot = (
  key: string,
  name: string,
  categories: string[],
  minDuration: number,
  maxDuration: number,
  intensity: number,
  optional: boolean,
  styleTags: string[],
  at?: number,
): MotionSlot => ({ key, name, categories, minDuration, maxDuration, intensity, optional, styleTags, ...(at === undefined ? {} : { at }) });

export const BUILTIN_BLUEPRINTS: Blueprint[] = [
  bp("hook_proof_cta", "Hook → Proof → CTA", "The dependable direct-response shape.", ["Ads", "DTC"], [
    { kind: "hook", share: 2, note: "strongest frame first" },
    { kind: "text_beat", share: 1.4 },
    { kind: "product", share: 2 },
    { kind: "proof", share: 1.6 },
    { kind: "end_card", share: 1.4 },
  ], [
    slot("opening_accent", "OPENING ACCENT", ["opening"], 0.3, 0.8, 0.7, false, ["hook"], 0),
    slot("text_impact", "TEXT IMPACT", ["text"], 0.4, 1, 0.6, true, ["kinetic"], 0.2),
    slot("product_callout", "PRODUCT CALLOUT", ["product"], 0.6, 1.4, 0.5, false, ["clean"], 0.55),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.8, 1.6, 0.4, true, ["resolve"], 0.9),
  ]),
  bp("three_beat_burst", "Three Beat Burst", "Three fast statements, one landing.", ["TikTok", "Reels"], [
    { kind: "hook", share: 1.4 },
    { kind: "shot", share: 1.1 },
    { kind: "text_beat", share: 1 },
    { kind: "shot", share: 1.1 },
    { kind: "text_beat", share: 1 },
    { kind: "hold", share: 1.8, note: "let the last shot breathe" },
    { kind: "end_card", share: 1.2 },
  ], [
    slot("opening_accent", "OPENING ACCENT", ["opening"], 0.2, 0.6, 0.9, false, ["rapid-cut"], 0),
    slot("transition_event", "TRANSITION EVENT", ["transition"], 0.1, 0.3, 0.85, true, ["flash", "whip"], 0.35),
    slot("text_impact", "TEXT IMPACT", ["text"], 0.3, 0.7, 0.7, true, ["kinetic"], 0.5),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.5, 1.2, 0.3, true, ["hold"], 0.85),
  ]),
  bp("slow_reveal", "Slow Reveal", "Texture, detail, then the product.", ["Luxury", "Beauty"], [
    { kind: "detail", share: 2.2 },
    { kind: "detail", share: 1.8 },
    { kind: "text_beat", share: 1.2 },
    { kind: "product", share: 2.6 },
    { kind: "end_card", share: 1.4 },
  ], [
    slot("texture_moment", "TEXTURE MOMENT", ["texture"], 0.8, 1.8, 0.4, false, ["macro", "slow"], 0.05),
    slot("midpoint_surprise", "MIDPOINT SURPRISE", ["surprise"], 0.4, 1, 0.5, true, ["freeze"], 0.5),
    slot("product_callout", "PRODUCT CALLOUT", ["product"], 1, 2, 0.5, false, ["reveal"], 0.7),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.8, 1.6, 0.3, true, ["resolve"], 0.92),
  ]),
  bp("problem_solution", "Problem → Solution", "Tension then relief.", ["Ads", "Apps"], [
    { kind: "hook", share: 1.8 },
    { kind: "shot", share: 1.4 },
    { kind: "text_beat", share: 1.2 },
    { kind: "product", share: 2.2 },
    { kind: "proof", share: 1.4 },
    { kind: "end_card", share: 1.2 },
  ], [
    slot("opening_accent", "OPENING ACCENT", ["opening"], 0.3, 0.7, 0.7, false, ["tension"], 0),
    slot("transition_event", "TRANSITION EVENT", ["transition"], 0.15, 0.35, 0.8, true, ["snap"], 0.4),
    slot("product_callout", "PRODUCT CALLOUT", ["product"], 0.8, 1.6, 0.5, false, ["relief"], 0.6),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.6, 1.2, 0.35, true, ["resolve"], 0.9),
  ]),
  bp("editorial_essay", "Editorial Essay", "Lookbook pacing with annotated stills.", ["Fashion"], [
    { kind: "hook", share: 1.6 },
    { kind: "detail", share: 1.6 },
    { kind: "hold", share: 1.4 },
    { kind: "text_beat", share: 1.2 },
    { kind: "detail", share: 1.6 },
    { kind: "product", share: 1.8 },
    { kind: "end_card", share: 1.2 },
  ], [
    slot("texture_moment", "TEXTURE MOMENT", ["texture"], 0.6, 1.4, 0.35, true, ["still"], 0.15),
    slot("text_impact", "TEXT IMPACT", ["text"], 0.4, 0.9, 0.5, true, ["caption"], 0.45),
    slot("product_callout", "PRODUCT CALLOUT", ["product"], 0.6, 1.4, 0.45, false, ["editorial"], 0.75),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.5, 1, 0.3, true, ["fade"], 0.92),
  ]),
  bp("list_of_three", "List of Three", "Three features, one CTA.", ["SaaS", "DTC"], [
    { kind: "hook", share: 1.6 },
    { kind: "text_beat", share: 1.1 },
    { kind: "shot", share: 1.1 },
    { kind: "text_beat", share: 1.1 },
    { kind: "shot", share: 1.1 },
    { kind: "text_beat", share: 1.1 },
    { kind: "product", share: 1.6 },
    { kind: "end_card", share: 1.3 },
  ], [
    slot("opening_accent", "OPENING ACCENT", ["opening"], 0.3, 0.7, 0.6, false, ["list"], 0),
    slot("text_impact", "TEXT IMPACT", ["text"], 0.3, 0.7, 0.6, false, ["kinetic"], 0.3),
    slot("text_impact_2", "TEXT IMPACT", ["text"], 0.3, 0.7, 0.6, false, ["kinetic"], 0.55),
    slot("product_callout", "PRODUCT CALLOUT", ["product"], 0.7, 1.4, 0.5, false, ["clean"], 0.8),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.5, 1, 0.3, true, ["cta"], 0.93),
  ]),
  bp("testimonial", "Testimonial", "Face, claim, evidence, sign-off.", ["Proof", "UGC"], [
    { kind: "hook", share: 2 },
    { kind: "text_beat", share: 1.4 },
    { kind: "proof", share: 2 },
    { kind: "product", share: 1.6 },
    { kind: "end_card", share: 1.2 },
  ], [
    slot("opening_accent", "OPENING ACCENT", ["opening"], 0.3, 0.8, 0.6, true, ["candid"], 0),
    slot("midpoint_surprise", "MIDPOINT SURPRISE", ["surprise"], 0.4, 1, 0.4, true, ["freeze"], 0.5),
    slot("product_callout", "PRODUCT CALLOUT", ["product"], 0.7, 1.4, 0.5, false, ["clean"], 0.75),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.6, 1.2, 0.3, true, ["resolve"], 0.92),
  ]),
  bp("one_shot_statement", "One Shot Statement", "A single held image and one sentence.", ["Brand"], [
    { kind: "hold", share: 3.4 },
    { kind: "text_beat", share: 1.6 },
    { kind: "end_card", share: 1.4 },
  ], [
    slot("texture_moment", "TEXTURE MOMENT", ["texture"], 1, 2.5, 0.3, true, ["still"], 0.1),
    slot("text_impact", "TEXT IMPACT", ["text"], 0.6, 1.4, 0.5, false, ["single-line"], 0.55),
    slot("ending_treatment", "ENDING TREATMENT", ["ending"], 0.8, 1.6, 0.3, true, ["fade"], 0.9),
  ]),
];

const KEY = "tempo.blueprints.v1";
const EMPTY: Blueprint[] = [];
let custom: Blueprint[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) custom = JSON.parse(raw) as Blueprint[];
  } catch {
    /* ignore */
  }
}

function commit(next: Blueprint[]) {
  custom = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(custom));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function allBlueprints(): Blueprint[] {
  hydrate();
  return [...BUILTIN_BLUEPRINTS, ...custom];
}

export function blueprintById(id?: string | null) {
  return allBlueprints().find((b) => b.id === id);
}

export function saveBlueprint(b: Omit<Blueprint, "id" | "source"> & { id?: string }) {
  hydrate();
  const id = b.id ?? `bp-${Date.now().toString(36)}`;
  const next: Blueprint = { ...b, id, source: "custom" };
  commit([next, ...custom.filter((x) => x.id !== id)]);
  return next;
}

export function deleteBlueprint(id: string) {
  hydrate();
  commit(custom.filter((b) => b.id !== id));
}

export function useBlueprints() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => custom,
    () => EMPTY,
  );
}

const PURPOSE_OF: Record<BlockKind, Purpose> = {
  hook: "hook",
  shot: "lifestyle",
  product: "product",
  detail: "detail",
  proof: "proof",
  hold: "hero",
  text_beat: "lifestyle",
  end_card: "hero",
};

/** Time positions of each block once the blueprint is scaled to a duration. */
export function blockTimeline(blueprint: Blueprint, duration: number) {
  const total = blueprint.blocks.reduce((a, b) => a + b.share, 0) || 1;
  let t = 0;
  return blueprint.blocks.map((b) => {
    const d = Number(((b.share / total) * duration).toFixed(2));
    const row = { ...b, start: Number(t.toFixed(2)), duration: d };
    t += d;
    return row;
  });
}

/**
 * Retimes a generated spec so its spine and text land on the blueprint's
 * blocks. Layout, motion and look are untouched — only structure.
 */
export function applyBlueprint(spec: TemplateSpec, blueprint?: Blueprint | null): TemplateSpec {
  if (!blueprint) return spec;
  const timeline = blockTimeline(blueprint, spec.duration);
  const spine = spec.mediaSlots.filter((s) => s.layout === "full").sort((a, b) => a.start - b.start);
  if (!spine.length) return spec;

  // shots absorb the time of the text beats that sit inside them, so the
  // full-screen spine stays gapless
  const shotBlocks = timeline.filter((b) => b.kind !== "text_beat");
  const newSpine = shotBlocks.map((block, i) => {
    const src = spine[i % spine.length]!;
    const next = shotBlocks[i + 1];
    const start = i === 0 ? 0 : block.start;
    const end = next ? next.start : spec.duration;
    return {
      ...src,
      id: `bp_${block.kind}_${i + 1}`,
      label: block.kind.replace("_", " ").toUpperCase(),
      start: Number(start.toFixed(2)),
      duration: Number(Math.max(0.3, end - start).toFixed(2)),
      purpose: PURPOSE_OF[block.kind],
    };
  });

  // non-spine (layout) slots keep their relative position on the new timeline
  const others = spec.mediaSlots
    .filter((s) => s.layout !== "full")
    .map((s) => {
      const ratio = s.start / Math.max(0.01, spec.duration);
      const start = Number((ratio * spec.duration).toFixed(2));
      const duration = Math.min(s.duration, spec.duration - start);
      return { ...s, start, duration: Math.max(0.2, duration) };
    })
    .filter((s) => s.start + s.duration <= spec.duration + 0.01);

  const endBlock = timeline.find((b) => b.kind === "end_card");
  const sortedText = [...spec.textSlots].sort((a, b) => a.start - b.start);
  const cta = sortedText.find((t) => t.label === "CTA" || t.style === "cta_lockup");
  const rest = sortedText.filter((t) => t !== cta);

  // anchors: every text beat first, then the remaining shots — one line each,
  // so copy never stacks on top of itself
  const anchors = [
    ...timeline.filter((b) => b.kind === "text_beat"),
    ...timeline.filter((b) => b.kind !== "text_beat" && b.kind !== "end_card"),
  ]
    .sort((a, b) => a.start - b.start)
    .slice(0, Math.max(1, rest.length));

  const textSlots: TextSlot[] = rest.map((t, i) => {
    const block = anchors[i];
    if (!block) return t;
    const limit = endBlock ? endBlock.start : spec.duration;
    const duration = Math.min(
      Math.max(0.6, block.duration * 1.1),
      Math.max(0.6, limit - block.start - 0.05),
    );
    return { ...t, start: block.start, duration: Number(duration.toFixed(2)) };
  });

  if (cta) {
    const start = endBlock ? endBlock.start : Math.max(0, spec.duration - 2);
    textSlots.push({
      ...cta,
      start,
      duration: Number((spec.duration - start).toFixed(2)),
    });
  }

  return {
    ...spec,
    mediaSlots: [...newSpine, ...others],
    textSlots,
    tags: [...new Set([...(spec.tags ?? []), blueprint.name])],
  };
}

/**
 * Resolves a blueprint's motion slots onto a concrete timeline: `at`
 * (normalized 0-1) becomes `start` in seconds, and duration is clamped to
 * [minDuration, maxDuration] against the available runway.
 */
export function resolveMotionSlots(
  blueprint: Blueprint,
  duration: number,
): (MotionSlot & { start: number; duration: number })[] {
  const slots = blueprint.motionSlots ?? [];
  return slots
    .map((s, i) => {
      const at = s.at ?? i / Math.max(1, slots.length);
      const start = Number((Math.min(1, Math.max(0, at)) * duration).toFixed(2));
      const remaining = Math.max(0.1, duration - start);
      const dur = Number(Math.min(s.maxDuration, Math.max(s.minDuration, Math.min(s.maxDuration, remaining))).toFixed(2));
      return { ...s, start, duration: Math.min(dur, remaining) };
    })
    .sort((a, b) => a.start - b.start);
}
