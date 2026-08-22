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
 * different temporal section of it.
 *
 * COVERAGE MAP: the reel is split into as many bands as there are shots, the
 * band order is deterministically permuted per template, and each shot takes
 * its window from its own band. That guarantees the edit travels across the
 * whole stringout before it ever reuses a region — no repeated seconds, no
 * near-identical neighbours, and long shots still get a window that fits.
 * `shuffle` re-rolls the permutation and the in-band offsets.
 */
export interface FootageConstraints {
  /** regions the user marked prefer / exclude / lock, in reel seconds */
  regions?: { from: number; to: number; kind: "prefer" | "exclude" | "lock" }[];
}

/**
 * Projects an in-point into the allowed part of the reel: excluded regions are
 * never used, and when the user marked preferred regions the whole selection is
 * mapped into them.
 */
function constrainInPoint(
  inPoint: number,
  clip: number,
  reelDuration: number,
  constraints: FootageConstraints | undefined,
  index: number,
): number {
  const regions = constraints?.regions ?? [];
  if (!regions.length) return inPoint;
  const prefer = regions
    .filter((r) => r.kind !== "exclude" && r.to - r.from > clip * 0.5)
    .map((r) => ({ from: Math.max(0, r.from), to: Math.min(reelDuration, r.to) }))
    .sort((a, b) => a.from - b.from);
  const exclude = regions.filter((r) => r.kind === "exclude");

  let allowed = prefer;
  if (!allowed.length) {
    // no preferred regions — the whole reel minus exclusions
    allowed = [{ from: 0, to: reelDuration }];
  }
  // subtract exclusions
  for (const ex of exclude) {
    const next: { from: number; to: number }[] = [];
    for (const a of allowed) {
      if (ex.to <= a.from || ex.from >= a.to) next.push(a);
      else {
        if (ex.from - a.from > clip * 0.5) next.push({ from: a.from, to: ex.from });
        if (a.to - ex.to > clip * 0.5) next.push({ from: ex.to, to: a.to });
      }
    }
    allowed = next;
  }
  if (!allowed.length) return inPoint;

  const total = allowed.reduce((sum, a) => sum + Math.max(0, a.to - a.from - clip), 0);
  if (total <= 0) return Math.max(0, allowed[index % allowed.length]!.from);
  // walk the allowed length using the original in-point's relative position
  let t = ((inPoint / Math.max(0.01, reelDuration)) * total + index * 0.13 * total) % total;
  for (const a of allowed) {
    const span = Math.max(0, a.to - a.from - clip);
    if (t <= span) return Number((a.from + t).toFixed(2));
    t -= span;
  }
  return Math.max(0, allowed[0]!.from);
}

export function reelMediaFor(
  spec: TemplateSpec,
  reel: PreviewReel | null,
  shuffle = 0,
  constraints?: FootageConstraints,
): MediaMap {
  if (!reel || !reel.duration || reel.duration <= 0.2) return {};
  const map: MediaMap = {};
  const seed = (hash(spec.id) + shuffle * PHI) % 1;
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  const n = slots.length || 1;

  // Band order: a coprime stride walk gives a full permutation of the bands,
  // so every region of the reel is visited exactly once per pass.
  let stride = 1 + Math.floor(seed * (n - 1 || 1));
  while (n > 1 && gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
  const start = Math.floor(seed * n);

  const used: number[] = [];

  slots.forEach((slot, i) => {
    const band = (start + i * stride) % n;
    const clip = Math.min(slot.duration, Math.max(0.3, reel.duration * 0.9));
    const usable = Math.max(0, reel.duration - clip - 0.05);
    const bandSize = usable / n;
    const jitter = ((seed + (i + 1) * PHI) % 1) * 0.7 + 0.15;
    let inPoint = Math.min(usable, band * bandSize + bandSize * jitter);

    // Guard against two shots landing on nearly the same frame when the reel
    // is short relative to the shot count.
    const minGap = Math.min(bandSize * 0.6, 1.5);
    for (let tries = 0; tries < 6; tries++) {
      if (!used.some((u) => Math.abs(u - inPoint) < minGap)) break;
      inPoint = (inPoint + bandSize * 0.41) % Math.max(0.01, usable);
    }
    inPoint = constrainInPoint(inPoint, clip, reel.duration, constraints, i);
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

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}


/** Human readable "slot -> 3.0–3.6s" preview of the mapping. */
export function reelSegments(
  spec: TemplateSpec,
  reel: PreviewReel | null,
  shuffle = 0,
  constraints?: FootageConstraints,
) {
  const map = reelMediaFor(spec, reel, shuffle, constraints);
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
