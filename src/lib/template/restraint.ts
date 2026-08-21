/**
 * RESTRAINT PASS
 *
 * Runs on every spec before it is ever shown. It does not add anything — it
 * only REMOVES. Great footage, great timing, good typography and one or two
 * strong moments beat a demo reel of effects.
 */
import type { TemplateSpec } from "./types";

export interface RestraintOptions {
  /** 0–10 effect amount already chosen by the style */
  effectAmount?: number;
  /** keep the last beat clean so the ending resolves */
  protectEnding?: boolean;
}

/** Max creative moments per 10 seconds, deliberately low. */
function momentBudget(duration: number, amount: number) {
  const per10 = amount <= 1 ? 1 : amount <= 3 ? 1.5 : amount <= 6 ? 2.2 : amount <= 8 ? 3 : 3.8;
  return Math.max(1, Math.round((per10 * duration) / 10));
}

export function restraintPass(spec: TemplateSpec, opts: RestraintOptions = {}): TemplateSpec {
  const amount = opts.effectAmount ?? 5;
  const protectEnding = opts.protectEnding ?? true;
  const budget = momentBudget(spec.duration, amount);
  const minGap = Math.max(0.8, spec.duration / (budget * 2.4));
  const endingQuietFrom = spec.duration * 0.88;

  // 1. creative events: drop crowded moments, repeated kernels and anything
  //    stepping on the ending resolve.
  let lastAt = -Infinity;
  let lastKernel = "";
  const kernelCounts: Record<string, number> = {};
  const creativeEvents = [...(spec.creativeEvents ?? [])]
    .sort((a, b) => a.start - b.start)
    .filter((e) => {
      if (protectEnding && e.start > endingQuietFrom) return false;
      if (e.start - lastAt < minGap) return false;
      if (e.kernel === lastKernel) return false;
      const n = (kernelCounts[e.kernel] ?? 0) + 1;
      if (n > 2) return false;
      kernelCounts[e.kernel] = n;
      lastAt = e.start;
      lastKernel = e.kernel;
      return true;
    })
    .slice(0, budget);

  // 2. imported motion assets: at most one major moment plus one secondary in
  //    a typical short. Premium should mean better, not more.
  const assetCap = Math.max(1, Math.round(spec.duration / 7));
  let lastAsset = -Infinity;
  const motionAssets = [...(spec.motionAssets ?? [])]
    .sort((a, b) => a.start - b.start)
    .filter((e) => {
      if (e.start - lastAsset < minGap) return false;
      lastAsset = e.start;
      return true;
    })
    .slice(0, assetCap);

  // 3. overlays: keep the grade-level ones, drop stacked duplicates.
  const seenOverlay = new Set<string>();
  const overlays = spec.overlays
    .filter((o) => {
      if (seenOverlay.has(o.type)) return false;
      seenOverlay.add(o.type);
      return true;
    })
    .slice(0, amount <= 2 ? 2 : amount <= 6 ? 3 : 4);

  // 4. typography: never two text slots fighting for the same instant.
  let lastText = -Infinity;
  const textSlots = [...spec.textSlots]
    .sort((a, b) => a.start - b.start)
    .filter((t) => {
      if (t.start - lastText < 0.35) return false;
      lastText = t.start;
      return true;
    });

  return { ...spec, creativeEvents, motionAssets, overlays, textSlots };
}
