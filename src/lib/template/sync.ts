import { EVENT_WEIGHT } from "@/lib/audio/beatmap";
import type { AudioTrack, BeatEvent, TemplateSpec } from "./types";

/**
 * Musical re-timing that preserves template DNA.
 *
 * We do NOT cut on every beat. We take the template's existing cut structure and
 * nudge the *meaningful* boundaries — long shots, the surprise moment, the hero
 * ending, text and graphic entrances — toward the nearest musically significant
 * event. `tightness` (0..1) controls both how far we're willing to move a cut and
 * how selective we are about which events count.
 */
export function syncSpecToTrack(
  spec: TemplateSpec,
  track: AudioTrack,
  tightness: number,
): TemplateSpec {
  const map = track.beatMap;
  if (!map || map.events.length === 0) return spec;

  const offset = track.trimStart;
  const threshold = 0.25 + tightness * 0.55;
  const candidates = map.events
    .filter((e) => EVENT_WEIGHT[e.kind] >= threshold)
    .map((e) => Number((e.time - offset).toFixed(3)))
    .filter((t) => t > 0.05 && t < spec.duration - 0.05)
    .sort((a, b) => a - b);

  if (candidates.length < 2) return spec;

  // how far a cut may travel: loose = subtle influence, tight = snap hard
  const pull = 0.35 + tightness * 0.65;
  const window = 0.12 + tightness * 0.5;

  const snap = (t: number) => {
    let best = t;
    let bestD = Infinity;
    for (const c of candidates) {
      const d = Math.abs(c - t);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (bestD > window) return t;
    return Number((t + (best - t) * pull).toFixed(3));
  };

  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  const minShot = 0.18;
  const boundaries: number[] = [0];
  for (let i = 1; i < slots.length; i++) {
    const cur = slots[i]!;
    const prev = boundaries[i - 1]!;
    // only meaningful boundaries move; micro-cuts inside a burst keep their rhythm
    const moved = cur.duration > 0.35 || i === slots.length - 1 ? snap(cur.start) : cur.start;
    boundaries.push(Math.max(prev + minShot, Math.min(moved, spec.duration - minShot)));
  }

  const nextSlots = slots.map((s, i) => {
    const start = boundaries[i]!;
    const end = i === slots.length - 1 ? spec.duration : boundaries[i + 1]!;
    return { ...s, start: Number(start.toFixed(3)), duration: Number((end - start).toFixed(3)) };
  });

  const nextText = spec.textSlots.map((t) => {
    const start = snap(t.start);
    const clamped = Math.max(0, Math.min(start, spec.duration - 0.2));
    return {
      ...t,
      start: Number(clamped.toFixed(3)),
      duration: Number(Math.min(t.duration, spec.duration - clamped).toFixed(3)),
    };
  });

  const nextGraphics = (spec.graphicSlots ?? []).map((g) => {
    const start = Math.max(0, Math.min(snap(g.start), spec.duration - 0.2));
    return {
      ...g,
      start: Number(start.toFixed(3)),
      duration: Number(Math.min(g.duration, spec.duration - start).toFixed(3)),
    };
  });

  const nextOverlays = spec.overlays.map((o) => {
    const start = Math.max(0, Math.min(snap(o.start), spec.duration - 0.1));
    return {
      ...o,
      start: Number(start.toFixed(3)),
      duration: Number(Math.min(o.duration, spec.duration - start).toFixed(3)),
    };
  });

  return {
    ...spec,
    mediaSlots: nextSlots,
    textSlots: nextText,
    graphicSlots: nextGraphics,
    overlays: nextOverlays,
    beatMarkers: candidates.slice(0, 64),
  };
}

/** Events worth showing on the timeline ruler. */
export function majorEvents(events: BeatEvent[], offset = 0) {
  return events
    .filter((e) => EVENT_WEIGHT[e.kind] >= 0.6)
    .map((e) => ({ ...e, time: e.time - offset }))
    .filter((e) => e.time >= 0);
}
