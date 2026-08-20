/**
 * STAGE 3+4 OF THE PIPELINE — Editor and Critic.
 *
 * The Director/Composer produce the timeline; this module lays executable
 * creative moments over it (techniques from the growing library), then critiques
 * the result with an explicit anti-geometric bias and repairs what it flags.
 */
import { KERNEL_BY_ID } from "./kernels";
import { allTechniques, recordTechniqueUse, tasteScore, type Technique } from "./registry";
import type { CreativeEvent, EditPlan, TemplateSpec } from "@/lib/template/types";

function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GEOMETRIC_LAYOUTS = /^(split|grid|col|stack|sheet|panel|band)/;

/** 0..1 — how much of the edit is rectangles and split screens. */
export function geometryRatio(spec: TemplateSpec) {
  if (!spec.mediaSlots.length) return 0;
  const geo = spec.mediaSlots.filter((s) => GEOMETRIC_LAYOUTS.test(s.layout)).length;
  return geo / spec.mediaSlots.length;
}

function pickTechnique(
  pool: Technique[],
  rnd: () => number,
  opts: { organicBias: number; used: Set<string>; tags?: string[] },
) {
  let best = pool[0]!;
  let bestScore = -Infinity;
  for (const t of pool) {
    const k = KERNEL_BY_ID[t.kernel];
    if (!k) continue;
    const wanted = opts.tags ?? [];
    const overlap = t.tags.filter((x) => wanted.includes(x)).length;
    const score =
      (k.organic ? opts.organicBias * 2.2 : 0) +
      overlap * 1.5 +
      tasteScore(t.tags) * 0.2 +
      (t.favorite ? 1.6 : 0) +
      (t.origin !== "builtin" ? 1.1 : 0) -
      (opts.used.has(t.kernel) ? 3 : 0) -
      Math.min(t.uses, 6) * 0.12 +
      rnd() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  opts.used.add(best.kernel);
  return best;
}

export interface PlanOptions {
  seed: number;
  /** 0-10 */
  risk?: number;
  /** style/aesthetic tags to bias technique choice */
  tags?: string[];
  /** how many moments to place; defaults to duration-based */
  density?: number;
}

export function planCreativeMoments(spec: TemplateSpec, opts: PlanOptions): TemplateSpec {
  const rnd = rngFrom(opts.seed);
  const risk = opts.risk ?? 4;
  const library = allTechniques();
  if (!library.length) return spec;

  const geo = geometryRatio(spec);
  // anti-geometric bias: the more rectangles in the cut, the more organic the
  // creative layer must be.
  const organicBias = Math.min(1, 0.35 + geo * 1.1 + risk * 0.03);

  const count =
    opts.density ??
    Math.max(2, Math.min(6, Math.round(spec.duration / 3.2) + (risk > 6 ? 1 : 0)));

  const used = new Set<string>();
  const anchors: number[] = [];
  const surpriseAt = (spec.direction?.surpriseAt ?? 0.5) * spec.duration;
  anchors.push(surpriseAt);
  // hang the rest off cut points so moments land on edits, not arbitrary times
  const cuts = spec.mediaSlots.map((s) => s.start).filter((t) => t > 0.2);
  const beats = spec.beatMarkers.length ? spec.beatMarkers : cuts;
  for (let i = 0; anchors.length < count && i < beats.length * 2; i++) {
    const t = beats[Math.floor(rnd() * beats.length)];
    if (t === undefined) break;
    if (anchors.every((a) => Math.abs(a - t) > 0.9)) anchors.push(t);
  }
  anchors.sort((a, b) => a - b);

  const events: CreativeEvent[] = [];
  const techniqueIds: string[] = [];
  anchors.forEach((at, i) => {
    const t = pickTechnique(library, rnd, { organicBias, used, ...(opts.tags ? { tags: opts.tags } : {}) });
    const k = KERNEL_BY_ID[t.kernel]!;
    const dur = Math.max(0.3, Math.min(t.duration * (0.85 + rnd() * 0.5), spec.duration - at));
    if (dur < 0.25) return;
    const word =
      spec.textSlots.find((s) => s.start <= at && s.start + s.duration >= at)?.value ??
      spec.textSlots[0]?.value;
    events.push({
      id: `ce-${i}-${Math.round(at * 100)}`,
      kernel: t.kernel,
      techniqueId: t.id,
      label: t.name,
      start: Math.max(0, Math.min(at, spec.duration - dur)),
      duration: dur,
      params: { ...t.params },
      layer: k.role === "treatment" ? "under_text" : "over_all",
      ...(word ? { word } : {}),
      seed: Math.floor(rnd() * 1000),
      opacity: k.role === "treatment" ? 0.9 : 1,
    });
    techniqueIds.push(t.id);
  });

  const plan = critique(spec, events, geo);
  recordTechniqueUse(techniqueIds);

  return { ...spec, creativeEvents: events, editPlan: plan };
}

/** STAGE 4 — the critic. Explicit, readable notes shown in the DNA panel. */
export function critique(
  spec: TemplateSpec,
  events: CreativeEvent[],
  geo = geometryRatio(spec),
): EditPlan {
  const notes: string[] = [];
  let score = 8.2;

  if (geo > 0.55) {
    notes.push("Cut leans rectangular — organic masks and analog texture added to break the grid.");
    score -= 1.4;
  } else if (geo < 0.2) {
    notes.push("Layout stays off-grid; frames read as composed rather than divided.");
    score += 0.4;
  }

  const organic = events.filter((e) => KERNEL_BY_ID[e.kernel]?.organic).length;
  if (events.length && organic / events.length >= 0.5) {
    notes.push("Majority of the creative moments are hand-made/analog, not geometric wipes.");
    score += 0.6;
  } else if (events.length) {
    notes.push("Creative layer is graphic-heavy; consider a torn or drawn moment.");
    score -= 0.5;
  }

  const kernels = new Set(events.map((e) => e.kernel));
  if (kernels.size < events.length) {
    notes.push("A technique repeats inside one edit — repetition dulls the surprise.");
    score -= 0.8;
  }

  const spacing = events
    .map((e, i) => (i === 0 ? e.start : e.start - events[i - 1]!.start))
    .filter((v, i) => i > 0);
  if (spacing.some((s) => s < 0.8)) {
    notes.push("Two moments stack too closely; the second will not register.");
    score -= 0.7;
  }

  if (!events.length) {
    notes.push("No creative moments placed — the edit relies on cuts alone.");
    score -= 1.5;
  } else {
    notes.push(
      `${events.length} authored moment${events.length > 1 ? "s" : ""}: ${events
        .map((e) => e.label ?? e.kernel)
        .join(" → ")}.`,
    );
  }

  return {
    intent: spec.direction?.creativeIdea ?? spec.name,
    beats: events.map((e) => ({ at: Number(e.start.toFixed(2)), move: e.label ?? e.kernel })),
    techniques: [...new Set(events.map((e) => e.techniqueId ?? e.kernel))],
    criticNotes: notes,
    criticScore: Math.max(1, Math.min(10, Number(score.toFixed(1)))),
    geometryRatio: Number(geo.toFixed(2)),
  };
}
