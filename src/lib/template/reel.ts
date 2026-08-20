import type { MediaMap, TemplateSpec } from "./types";

export interface PreviewReel {
  url: string;
  name: string;
  /** source video duration in seconds */
  duration: number;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const PHI = 0.6180339887498949;

/**
 * Treat the uploaded video as a long source reel and hand every media slot a
 * different temporal section of it. No analysis, no shot detection — just a
 * deterministic low-discrepancy walk across the source so adjacent slots never
 * show consecutive frames.
 */
export function reelMediaFor(spec: TemplateSpec, reel: PreviewReel | null): MediaMap {
  if (!reel || !reel.duration || reel.duration <= 0.2) return {};
  const map: MediaMap = {};
  const seed = hash(spec.id);
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);

  slots.forEach((slot, i) => {
    const clip = Math.min(slot.duration, Math.max(0.3, reel.duration * 0.5));
    const usable = Math.max(0, reel.duration - clip - 0.05);
    // golden-ratio sequence: even coverage of the reel, large jumps between neighbours
    const t = (seed + (i + 1) * PHI) % 1;
    const inPoint = Number((t * usable).toFixed(2));
    map[slot.id] = {
      url: reel.url,
      kind: "video",
      name: reel.name,
      inPoint,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      muted: true,
    };
  });
  return map;
}

/** Human readable "slot -> 3.0–3.6s" preview of the mapping. */
export function reelSegments(spec: TemplateSpec, reel: PreviewReel | null) {
  const map = reelMediaFor(spec, reel);
  return spec.mediaSlots.map((s) => {
    const a = map[s.id]?.inPoint ?? 0;
    return { id: s.id, label: s.label, from: a, to: Number((a + s.duration).toFixed(2)) };
  });
}
