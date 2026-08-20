/**
 * TEMPLATE AUTOPSY
 *
 * Reads an existing TemplateSpec and produces a structured, human-readable
 * breakdown of its structure, rhythm, copy, motion and music relationships —
 * plus a list of scored "strengths": candidate time regions worth harvesting
 * as reusable creative parts.
 */
import { blueprintById } from "@/lib/blueprint/library";
import type { TemplateSpec } from "@/lib/template/types";

export interface RhythmStats {
  durations: number[];
  mean: number;
  min: number;
  max: number;
  microcutCount: number;
  holdCount: number;
  /** normalised 0-1 bar heights for a rhythm visualisation */
  bars: { start: number; duration: number; height: number; kind: "microcut" | "normal" | "hold" }[];
}

export interface BeatAlignment {
  cutTime: number;
  beatTime: number;
  deltaMs: number;
}

export type StrengthKind =
  | "Strong Opener"
  | "Good Text Moment"
  | "Interesting Product Reveal"
  | "Useful Graphic Event"
  | "Strong Transition Sequence"
  | "Strong Ending";

export interface Strength {
  kind: StrengthKind;
  range: [number, number];
  score: number;
  reason: string;
}

export interface Autopsy {
  blueprint: { id: string; name: string } | null;
  rhythm: RhythmStats;
  copyPlacements: { id: string; value: string; start: number; duration: number; style: string; position: string }[];
  typeSystems: string[];
  motionSlotsUsed: string[];
  motionKitItems: { id: string; label?: string; start: number; duration: number }[];
  creativeEvents: { id: string; kernel: string; start: number; duration: number; label?: string }[];
  brandAssets: string[];
  endCardId?: string | undefined;
  beatAlignment: BeatAlignment[];
  openingSummary: string;
  endingSummary: string;
  strengths: Strength[];
}

const MICROCUT_THRESHOLD = 0.6;
const HOLD_THRESHOLD = 1.8;
const BEAT_TOLERANCE_MS = 80;

function spine(spec: TemplateSpec) {
  return spec.mediaSlots.filter((s) => s.layout === "full").sort((a, b) => a.start - b.start);
}

function computeRhythm(spec: TemplateSpec): RhythmStats {
  const shots = spine(spec);
  const durations = shots.map((s) => s.duration);
  const max = durations.length ? Math.max(...durations) : 1;
  const min = durations.length ? Math.min(...durations) : 0;
  const mean = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const bars = shots.map((s) => ({
    start: s.start,
    duration: s.duration,
    height: max > 0 ? Math.max(0.08, s.duration / max) : 0.5,
    kind: (s.duration <= MICROCUT_THRESHOLD
      ? "microcut"
      : s.duration >= HOLD_THRESHOLD
        ? "hold"
        : "normal") as "microcut" | "normal" | "hold",
  }));
  return {
    durations,
    mean: Number(mean.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    microcutCount: bars.filter((b) => b.kind === "microcut").length,
    holdCount: bars.filter((b) => b.kind === "hold").length,
    bars,
  };
}

function computeBeatAlignment(spec: TemplateSpec): BeatAlignment[] {
  const beats = spec.beatMarkers ?? [];
  if (!beats.length) return [];
  const cuts = spine(spec)
    .slice(1)
    .map((s) => s.start);
  const out: BeatAlignment[] = [];
  for (const cut of cuts) {
    let best: number | null = null;
    let bestDelta = Infinity;
    for (const b of beats) {
      const delta = Math.abs(b - cut) * 1000;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = b;
      }
    }
    if (best !== null && bestDelta <= BEAT_TOLERANCE_MS) {
      out.push({ cutTime: cut, beatTime: best, deltaMs: Number(bestDelta.toFixed(1)) });
    }
  }
  return out;
}

function scoreOpener(spec: TemplateSpec): Strength | null {
  const shots = spine(spec);
  const first = shots[0];
  if (!first) return null;
  const hasText = spec.textSlots.some((t) => t.start < first.duration + 0.2);
  const hasEvent = (spec.creativeEvents ?? []).some((e) => e.start < first.duration + 0.2);
  const score = 5 + (hasText ? 2 : 0) + (hasEvent ? 2 : 0) + (first.animationIn && first.animationIn !== "none" ? 1 : 0);
  return {
    kind: "Strong Opener",
    range: [0, Math.max(0.6, first.duration)],
    score: Math.min(10, score),
    reason: `Opening shot (${first.duration.toFixed(1)}s)${hasText ? " with text" : ""}${hasEvent ? " and a creative event" : ""}.`,
  };
}

function scoreTextMoments(spec: TemplateSpec): Strength[] {
  return spec.textSlots
    .map((t) => {
      const dense = t.value.length > 12;
      const styled = t.style !== "subtitle" && t.style !== "minimal_caption";
      const score = 4 + (dense ? 1.5 : 0) + (styled ? 2 : 0) + (t.accent ? 1.5 : 0);
      return {
        kind: "Good Text Moment" as const,
        range: [t.start, t.start + t.duration] as [number, number],
        score: Math.min(10, Number(score.toFixed(1))),
        reason: `"${t.value}" · ${t.style}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function scoreProductReveals(spec: TemplateSpec): Strength[] {
  return spine(spec)
    .filter((s) => s.purpose === "product" || s.purpose === "hero")
    .map((s) => {
      const hasEvent = (spec.creativeEvents ?? []).some(
        (e) => e.start >= s.start - 0.1 && e.start < s.start + s.duration,
      );
      const score = 5 + (hasEvent ? 2.5 : 0) + (s.duration > 1 ? 1.5 : 0);
      return {
        kind: "Interesting Product Reveal" as const,
        range: [s.start, s.start + s.duration] as [number, number],
        score: Math.min(10, score),
        reason: `${s.purpose} shot${hasEvent ? " with a creative event" : ""}.`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function scoreGraphicEvents(spec: TemplateSpec): Strength[] {
  return (spec.graphicSlots ?? [])
    .map((g) => ({
      kind: "Useful Graphic Event" as const,
      range: [g.start, g.start + g.duration] as [number, number],
      score: Math.min(10, 5 + (g.animation !== "fade" ? 1.5 : 0) + (g.text ? 1.5 : 0)),
      reason: `${g.kind}${g.text ? ` "${g.text}"` : ""} · ${g.animation}`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function scoreTransitions(spec: TemplateSpec): Strength[] {
  const shots = spine(spec);
  const out: Strength[] = [];
  for (let i = 0; i < shots.length - 1; i++) {
    const a = shots[i]!;
    const b = shots[i + 1]!;
    if (!a.transitionOut || a.transitionOut === "hard_cut") continue;
    const score = 5 + (a.transitionOut ? 2 : 0) + (a.duration <= MICROCUT_THRESHOLD ? 1.5 : 0);
    out.push({
      kind: "Strong Transition Sequence",
      range: [Math.max(0, a.start + a.duration - 0.4), Math.min(spec.duration, b.start + 0.4)],
      score: Math.min(10, score),
      reason: `${a.transitionOut} into ${b.purpose}.`,
    });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 2);
}

function scoreEnding(spec: TemplateSpec): Strength | null {
  const shots = spine(spec);
  const last = shots[shots.length - 1];
  if (!last) return null;
  const hasEndCard = Boolean(spec.endCardId);
  const cta = spec.textSlots.find((t) => t.label === "CTA" || t.style === "cta_lockup");
  const score = 5 + (hasEndCard ? 2 : 0) + (cta ? 2 : 0);
  const start = Math.min(last.start, cta?.start ?? last.start);
  return {
    kind: "Strong Ending",
    range: [start, spec.duration],
    score: Math.min(10, score),
    reason: `${hasEndCard ? "End card" : "Final shot"}${cta ? " with CTA copy" : ""}.`,
  };
}

export function autopsy(spec: TemplateSpec): Autopsy {
  const bp = blueprintById(spec.blueprintId);
  const rhythm = computeRhythm(spec);
  const shots = spine(spec);
  const first = shots[0];
  const last = shots[shots.length - 1];

  const strengths: Strength[] = [
    ...(scoreOpener(spec) ? [scoreOpener(spec)!] : []),
    ...scoreTextMoments(spec),
    ...scoreProductReveals(spec),
    ...scoreGraphicEvents(spec),
    ...scoreTransitions(spec),
    ...(scoreEnding(spec) ? [scoreEnding(spec)!] : []),
  ].sort((a, b) => b.score - a.score);

  return {
    blueprint: bp ? { id: bp.id, name: bp.name } : null,
    rhythm,
    copyPlacements: spec.textSlots.map((t) => ({
      id: t.id,
      value: t.value,
      start: t.start,
      duration: t.duration,
      style: t.style,
      position: t.position,
    })),
    typeSystems: spec.typeSystemIds ?? (spec.fontKey ? [spec.fontKey] : []),
    motionSlotsUsed: Object.keys(spec.motionSlotPlan ?? {}),
    motionKitItems: (spec.motionAssets ?? []).map((m) => ({
      id: m.id,
      label: m.label,
      start: m.start,
      duration: m.duration,
    })),
    creativeEvents: (spec.creativeEvents ?? []).map((e) => ({
      id: e.id,
      kernel: e.kernel,
      start: e.start,
      duration: e.duration,
      label: e.label,
    })),
    brandAssets: [...new Set((spec.motionAssets ?? []).map((m) => m.assetId))],
    endCardId: spec.endCardId,
    beatAlignment: computeBeatAlignment(spec),
    openingSummary: first
      ? `Opens on a ${first.duration.toFixed(1)}s ${first.purpose} shot (${first.layout}).`
      : "No opening shot detected.",
    endingSummary: last
      ? `Closes on a ${last.duration.toFixed(1)}s ${last.purpose} shot${spec.endCardId ? " + end card" : ""}.`
      : "No closing shot detected.",
    strengths,
  };
}
