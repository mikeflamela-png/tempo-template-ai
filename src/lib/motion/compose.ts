/**
 * MOTION COMPOSITION — restraint, contrast and hierarchy.
 *
 * Generation used to sprinkle effects. This module decides, for a given spec:
 *   how many treatments the edit may carry at all (a BUDGET, not a random count)
 *   where they land (opening / middle / ending, never two in a row)
 *   which come from imported PREMIUM assets vs native Tempo kernels
 *
 * The result is written back as `spec.motionAssets` and a trimmed
 * `spec.creativeEvents`, so both the Player and the server renderer see the
 * same plan.
 */
import type { MotionAssetEvent, TemplateSpec } from "@/lib/template/types";
import type { MotionPack } from "@/lib/motion/packs";
import { packByKey } from "@/lib/motion/packs";
import { styleProfileFor } from "@/lib/template/styleprofiles";
import {
  motionAssetById,
  pickAssetsForSlot,
  type CreativeSource,
  type EditSection,
  type MotionAsset,
  type MotionAssetRole,
} from "@/lib/motion/assets";

export interface ComposeOptions {
  /** 0–10 slider from the Create screen */
  effectAmount?: number | undefined;
  source?: CreativeSource | undefined;
  pack?: MotionPack | null | undefined;
  brandId?: string | undefined;
  styleTags?: string[] | undefined;
  /** style key from styleprofiles.ts — restricts assets to that style's kit/allowed categories */
  styleKey?: string | undefined;
  rng?: () => number;
}

/** Treatments allowed per 10s of edit, by effect amount. Deliberately low. */
function budgetFor(duration: number, amount: number): number {
  const per10 = amount <= 1 ? 0.6 : amount <= 3 ? 1.2 : amount <= 6 ? 2.2 : amount <= 8 ? 3.2 : 4.2;
  return Math.max(0, Math.round((per10 * duration) / 10));
}

function sectionOf(t: number, duration: number): EditSection {
  if (t < duration * 0.25) return "opening";
  if (t > duration * 0.75) return "ending";
  return "middle";
}

/**
 * Candidate moments: the strongest places to put a treatment are shot changes,
 * the first frame, the last hold and any beat marker that coincides with a cut.
 */
function candidateMoments(spec: TemplateSpec): { at: number; role: MotionAssetRole }[] {
  const out: { at: number; role: MotionAssetRole }[] = [];
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  if (slots[0]) out.push({ at: slots[0].start, role: "opener" });
  slots.slice(1).forEach((s) => out.push({ at: s.start, role: "transition" }));
  const textPeaks = (spec.textSlots ?? []).map((t) => ({
    at: t.start,
    role: "text support" as MotionAssetRole,
  }));
  out.push(...textPeaks);
  const last = slots[slots.length - 1];
  if (last) out.push({ at: Math.max(0, last.start + last.duration * 0.55), role: "ending" });
  return out.sort((a, b) => a.at - b.at);
}

/**
 * CONTRAST RULE: never two treatments inside `gap` seconds, and never the same
 * role twice in a row. Quiet stretches are what make a hit land.
 */
function spaceOut<T extends { at: number; role: MotionAssetRole }>(
  moments: T[],
  gap: number,
  limit: number,
): T[] {
  const kept: T[] = [];
  for (const m of moments) {
    const prev = kept[kept.length - 1];
    if (prev && (m.at - prev.at < gap || prev.role === m.role)) continue;
    kept.push(m);
    if (kept.length >= limit) break;
  }
  return kept;
}

function eventFromAsset(
  asset: MotionAsset,
  at: number,
  role: MotionAssetRole,
  spec: TemplateSpec,
  rng: () => number,
): MotionAssetEvent {
  const natural = asset.durationSec > 0 ? asset.durationSec : 0.9;
  const min = asset.rules.minDuration ?? 0.35;
  const max = asset.rules.maxDuration ?? 2.6;
  const duration = Math.min(Math.max(natural, min), Math.min(max, spec.duration - at));
  const jitter = (v: number) => v + (rng() - 0.5) * 0.04;
  return {
    id: `ma-${asset.id}-${Math.round(at * 1000)}`,
    assetId: asset.id,
    slotKey: role,
    label: asset.name,
    start: Math.max(0, at),
    duration: Math.max(0.25, duration),
    scale: asset.defaultScale,
    x: jitter(asset.defaultX),
    y: jitter(asset.defaultY),
    opacity:
      asset.rules.intensity === "subtle"
        ? Math.min(asset.defaultOpacity, 0.42)
        : asset.rules.intensity === "medium"
          ? Math.min(asset.defaultOpacity, 0.8)
          : asset.defaultOpacity,
    ...(asset.blend ? { blend: asset.blend } : {}),
    ...(asset.loop ? { loop: true } : {}),
    ...(asset.reverse ? { reverse: true } : {}),
    ...(asset.speed !== 1 ? { speed: asset.speed } : {}),
  };
}

export interface ComposeResult {
  spec: TemplateSpec;
  /** how the budget was spent — surfaced in the DNA panel */
  plan: {
    budget: number;
    fromAssets: number;
    fromKernels: number;
    quietStretches: number;
  };
}

/**
 * Places imported motion assets into a spec under the restraint rules, and
 * trims native creative events so the total treatment count stays within the
 * budget. Safe to call with an empty asset library — it then only trims.
 */
export function composeMotion(spec: TemplateSpec, opts: ComposeOptions = {}): ComposeResult {
  const {
    effectAmount = 5,
    source = "curated",
    brandId,
    styleTags = [],
    styleKey,
    rng = Math.random,
  } = opts;

  const profile = styleProfileFor(styleKey);
  // priority: an explicit pack wins, otherwise the style profile's
  // recommended kit, so style controls actually steer which assets/kernels
  // are eligible.
  const pack = opts.pack ?? (profile ? packByKey(profile.recommendedPackKey) ?? null : null);
  const effectiveAmount = profile ? effectAmount * profile.effectBudgetMultiplier : effectAmount;
  const mergedStyleTags = profile ? [...new Set([...styleTags, ...profile.styleTags])] : styleTags;
  const discouraged = new Set(profile?.discouragedAssetCategories ?? []);

  const budget = budgetFor(spec.duration, effectiveAmount);
  if (budget === 0) {
    return {
      spec: { ...spec, motionAssets: [], creativeEvents: [] },
      plan: { budget: 0, fromAssets: 0, fromKernels: 0, quietStretches: 1 },
    };
  }

  // Target share of the budget drawn from the imported library.
  const assetShare =
    source === "curated" ? 0.6 : source === "balanced" ? 0.45 : source === "tempo" ? 0.2 : 0.5;
  const assetBudget = Math.round(budget * assetShare);

  const gap = Math.max(0.7, spec.duration / (budget * 2.2));
  const moments = spaceOut(candidateMoments(spec), gap, budget);

  const used: Record<string, number> = {};
  const events: MotionAssetEvent[] = [];
  for (const m of moments) {
    if (events.length >= assetBudget) break;
    const section = sectionOf(m.at, spec.duration);
    const [asset] = pickAssetsForSlot({
      roles: [m.role],
      ...(pack ? { kitKey: pack.key } : {}),
      ...(brandId ? { brandId } : {}),
      ...(mergedStyleTags.length ? { styleTags: mergedStyleTags } : {}),
      source,
      usedCounts: used,
      section,
      count: 1,
      rng,
    });
    if (!asset || discouraged.has(asset.category)) continue;
    used[asset.id] = (used[asset.id] ?? 0) + 1;
    events.push(eventFromAsset(asset, m.at, m.role, spec, rng));
  }

  // Native kernels fill whatever the library did not, and no more.
  const kernelBudget = Math.max(0, budget - events.length);
  const busy = (t: number) => events.some((e) => Math.abs(e.start - t) < gap * 0.8);
  const creativeEvents = [...(spec.creativeEvents ?? [])]
    .sort((a, b) => a.start - b.start)
    .filter((e) => !busy(e.start))
    .slice(0, kernelBudget);

  const treatments = [...events.map((e) => e.start), ...creativeEvents.map((e) => e.start)].sort(
    (a, b) => a - b,
  );
  let quiet = 0;
  for (let i = 1; i < treatments.length; i++) {
    if (treatments[i]! - treatments[i - 1]! > spec.duration * 0.2) quiet++;
  }

  return {
    spec: { ...spec, motionAssets: events, creativeEvents },
    plan: {
      budget,
      fromAssets: events.length,
      fromKernels: creativeEvents.length,
      quietStretches: quiet,
    },
  };
}

/** Resolves the assets a spec actually references — used by export preflight. */
export function referencedAssets(spec: TemplateSpec): MotionAsset[] {
  const ids = new Set((spec.motionAssets ?? []).map((e) => e.assetId));
  return [...ids].map((id) => motionAssetById(id)).filter((a): a is MotionAsset => Boolean(a));
}
