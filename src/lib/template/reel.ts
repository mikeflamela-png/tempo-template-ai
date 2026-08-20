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
 * Treat the uploaded video as a long stringout and hand every media slot a
 * different temporal section of it. No analysis, no shot detection — a
 * deterministic low-discrepancy walk across the source so adjacent slots never
 * show consecutive frames. `shuffle` re-rolls the whole distribution.
 */
export function reelMediaFor(
  spec: TemplateSpec,
  reel: PreviewReel | null,
  shuffle = 0,
): MediaMap {
  if (!reel || !reel.duration || reel.duration <= 0.2) return {};
  const map: MediaMap = {};
  const seed = (hash(spec.id) + shuffle * PHI) % 1;
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  const used: number[] = [];

  slots.forEach((slot, i) => {
    const clip = Math.min(slot.duration, Math.max(0.3, reel.duration * 0.5));
    const usable = Math.max(0, reel.duration - clip - 0.05);
    const minGap = Math.min(usable / Math.max(2, slots.length), 1.5);
    let t = (seed + (i + 1) * PHI) % 1;
    let inPoint = t * usable;
    // avoid adjacent / duplicate source windows
    for (let tries = 0; tries < 6; tries++) {
      const clash = used.some((u) => Math.abs(u - inPoint) < minGap);
      if (!clash) break;
      t = (t + PHI * 0.37) % 1;
      inPoint = t * usable;
    }
    used.push(inPoint);
    map[slot.id] = {
      url: reel.url,
      kind: "video",
      name: reel.name,
      inPoint: Number(inPoint.toFixed(2)),
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      muted: true,
    };
  });
  return map;
}

/** Human readable "slot -> 3.0–3.6s" preview of the mapping. */
export function reelSegments(spec: TemplateSpec, reel: PreviewReel | null, shuffle = 0) {
  const map = reelMediaFor(spec, reel, shuffle);
  return spec.mediaSlots.map((s) => {
    const a = map[s.id]?.inPoint ?? 0;
    return { id: s.id, label: s.label, from: a, to: Number((a + s.duration).toFixed(2)) };
  });
}

export function formatTimecode(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
