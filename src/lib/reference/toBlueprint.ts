/**
 * REFERENCE -> BLUEPRINT
 *
 * Turns a ReferenceAnalysis into a Tempo Blueprint: structural blocks sized
 * by the reference's own shot durations, plus semantic MotionSlots mapped
 * from the detected visual events (flash -> transition event, freeze ->
 * midpoint surprise, microcut burst -> opening accent, closing hold -> ending
 * treatment).
 */
import type { BlockKind, Blueprint, MotionSlot } from "@/lib/blueprint/library";
import { saveBlueprint } from "@/lib/blueprint/library";
import type { ReferenceAnalysis, VisualEvent } from "./analyze";

function kindForShot(duration: number, index: number, total: number): BlockKind {
  if (index === 0) return "hook";
  if (index === total - 1) return "end_card";
  if (duration < 0.4) return "shot";
  if (duration > 2.5) return "hold";
  if (index % 3 === 0) return "text_beat";
  if (index % 4 === 1) return "product";
  return "shot";
}

export function buildBlocksFromAnalysis(analysis: ReferenceAnalysis) {
  const shots = analysis.shots.length ? analysis.shots : [{ start: 0, end: analysis.duration, duration: analysis.duration }];
  // cap the number of blocks so the blueprint stays readable
  const maxBlocks = 10;
  const stride = Math.max(1, Math.ceil(shots.length / maxBlocks));
  const picked = shots.filter((_, i) => i % stride === 0);
  return picked.map((s, i) => ({
    kind: kindForShot(s.duration, i, picked.length),
    share: Number(Math.max(0.4, s.duration).toFixed(2)),
    note: `${s.duration.toFixed(2)}s in reference`,
  }));
}

function eventToSlot(event: VisualEvent, duration: number): MotionSlot | null {
  const at = Number((event.start / Math.max(0.01, duration)).toFixed(3));
  const len = Math.max(0.15, event.end - event.start);
  switch (event.type) {
    case "flash":
      return {
        key: `transition_event_${event.start}`,
        name: "TRANSITION EVENT",
        categories: ["transition"],
        minDuration: 0.1,
        maxDuration: 0.4,
        intensity: 0.9,
        optional: true,
        styleTags: ["flash", "whip"],
        at,
      };
    case "freeze":
      return {
        key: `midpoint_surprise_${event.start}`,
        name: "MIDPOINT SURPRISE",
        categories: ["surprise", "beat"],
        minDuration: len,
        maxDuration: len * 1.5,
        intensity: 0.7,
        optional: true,
        styleTags: ["freeze", "still"],
        at,
      };
    case "microcut_burst":
      return {
        key: `opening_accent_${event.start}`,
        name: "OPENING ACCENT",
        categories: ["opening"],
        minDuration: 0.3,
        maxDuration: 0.9,
        intensity: 0.85,
        optional: false,
        styleTags: ["rapid-cut", "energy"],
        at,
      };
    case "long_hold":
      return {
        key: `ending_treatment_${event.start}`,
        name: "ENDING TREATMENT",
        categories: ["ending"],
        minDuration: len,
        maxDuration: len,
        intensity: 0.4,
        optional: true,
        styleTags: ["hold", "resolve"],
        at,
      };
    default:
      return null;
  }
}

export function buildMotionSlotsFromAnalysis(analysis: ReferenceAnalysis): MotionSlot[] {
  const slots: MotionSlot[] = [];
  for (const event of analysis.visualEvents) {
    const slot = eventToSlot(event, analysis.duration);
    if (slot) slots.push(slot);
  }
  // ensure an ending treatment even if no long hold was detected — the
  // reference's last shot always deserves a landing beat
  if (!slots.some((s) => s.name === "ENDING TREATMENT")) {
    const lastShot = analysis.shots[analysis.shots.length - 1];
    slots.push({
      key: "ending_treatment_default",
      name: "ENDING TREATMENT",
      categories: ["ending"],
      minDuration: lastShot ? Math.min(lastShot.duration, 2) : 1,
      maxDuration: lastShot ? lastShot.duration : 2,
      intensity: 0.4,
      optional: true,
      styleTags: ["resolve"],
      at: 0.92,
    });
  }
  if (!slots.some((s) => s.name === "OPENING ACCENT")) {
    slots.push({
      key: "opening_accent_default",
      name: "OPENING ACCENT",
      categories: ["opening"],
      minDuration: 0.3,
      maxDuration: 0.8,
      intensity: 0.6,
      optional: true,
      styleTags: ["hook"],
      at: 0,
    });
  }
  return slots.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

export function analysisToBlueprint(analysis: ReferenceAnalysis, name?: string): Blueprint {
  const blocks = buildBlocksFromAnalysis(analysis);
  const motionSlots = buildMotionSlotsFromAnalysis(analysis);
  const pace =
    analysis.shotLengthBuckets.microcut + analysis.shotLengthBuckets.fast >
    analysis.shotLengthBuckets.medium + analysis.shotLengthBuckets.hold
      ? "fast-cut"
      : "measured";
  return saveBlueprint({
    name: name?.trim() || `Reference: ${analysis.fileName.replace(/\.[^/.]+$/, "")}`,
    blurb: `Autopsied from a ${analysis.duration.toFixed(1)}s reference — ${analysis.cuts.length} cuts, ${pace} pacing.`,
    bestFor: ["Reference match"],
    blocks,
    motionSlots,
  });
}
