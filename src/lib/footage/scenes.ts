import type { Clip } from "./types";

/**
 * LIGHTWEIGHT SCENE SUGGESTIONS
 *
 * No vision model. We read each clip's existing thumbnail, reduce it to a tiny
 * colour signature (4x4 RGB blocks + average luma), and group clips whose
 * signatures are close AND that sit near each other in the source. The result
 * is only ever a *suggestion* — the user accepts or ignores it.
 */

export interface SceneSuggestion {
  id: string;
  clipIds: string[];
}

const GW = 4;
const GH = 4;

const cache = new Map<string, Float32Array>();

function signatureFromThumb(thumb: string): Promise<Float32Array | null> {
  const cached = cache.get(thumb);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = GW;
        canvas.height = GH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, GW, GH);
        const { data } = ctx.getImageData(0, 0, GW, GH);
        const out = new Float32Array(GW * GH * 3);
        for (let i = 0; i < GW * GH; i++) {
          out[i * 3] = (data[i * 4] ?? 0) / 255;
          out[i * 3 + 1] = (data[i * 4 + 1] ?? 0) / 255;
          out[i * 3 + 2] = (data[i * 4 + 2] ?? 0) / 255;
        }
        cache.set(thumb, out);
        resolve(out);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = thumb;
  });
}

function distance(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return sum / a.length;
}

/**
 * Suggest scene groups for clips that aren't grouped yet. Clips are walked in
 * capture order; a run continues while the look stays similar.
 */
export async function suggestScenes(clips: Clip[]): Promise<SceneSuggestion[]> {
  const pool = clips
    .filter((c) => !c.rejected && !c.sceneId && c.thumb)
    .sort((a, b) => a.order - b.order);
  if (pool.length < 2) return [];

  const sigs = new Map<string, Float32Array>();
  for (const c of pool) {
    const sig = await signatureFromThumb(c.thumb!);
    if (sig) sigs.set(c.id, sig);
  }

  const out: SceneSuggestion[] = [];
  let run: Clip[] = [];

  const flush = () => {
    if (run.length >= 2) {
      out.push({ id: `sg-${out.length}-${run[0]!.id}`, clipIds: run.map((c) => c.id) });
    }
    run = [];
  };

  for (const clip of pool) {
    if (!run.length) {
      run = [clip];
      continue;
    }
    const prev = run[run.length - 1]!;
    const a = sigs.get(prev.id);
    const b = sigs.get(clip.id);
    const look = a && b ? distance(a, b) : 1;
    const sameSource = prev.sourceId === clip.sourceId;
    // nearby timestamps in the same stringout make a shared scene far likelier
    const gap = sameSource ? Math.abs(clip.start - prev.end) : Infinity;
    const near = gap < 12;
    const threshold = near ? 0.14 : sameSource ? 0.09 : 0.07;
    if (look <= threshold && run.length < 10) run.push(clip);
    else {
      flush();
      run = [clip];
    }
  }
  flush();
  return out;
}
