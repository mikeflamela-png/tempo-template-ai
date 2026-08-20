import type { CreativeDirection, TemplateSpec } from "./types";
import {
  CONCEPTS,
  buildDirection,
  chooseConcepts,
  composeConcept,
  conceptByKey,
  mulberry32,
  type GenerateOptions,
} from "./director";
import { FONTS, fontsIn } from "./fonts";
import { RHYTHMS } from "./rhythm";
import { applyStylePack, stylePackByKey } from "./stylepacks";
import { styleProfileFor } from "./styleprofiles";
import { applyMotionPack, packByKey } from "@/lib/motion/packs";
import { composeMotion } from "@/lib/motion/compose";
import { checkStyleRepresentation } from "./qa";

// Style/creative selection isn't part of director.ts's GenerateOptions — this
// augments that interface (declaration merging) rather than editing
// director.ts, so a `styleKey` and deterministic `seed` can flow through
// generateTemplates/regenerateSimilar/remixTemplate.
declare module "./director" {
  interface GenerateOptions {
    /** StylePack/StyleProfile key — e.g. "film_90s", "clean_tech" */
    styleKey?: string | undefined;
    /** deterministic seed for reproducible generation (tests) */
    seed?: number | undefined;
  }
}

/**
 * Applies the full style profile to a produced spec: transitions, overlays,
 * text styles, font and grade via applyStylePack, then restricts/composes
 * motion through the style's recommended kit. Retries once if the result
 * doesn't visibly represent the style.
 */
function applyStyleToSpec(spec: TemplateSpec, styleKey: string | undefined, seed: number): TemplateSpec {
  if (!styleKey) return spec;
  const pack = stylePackByKey(styleKey);
  const profile = styleProfileFor(styleKey);
  if (!pack || !profile) return spec;

  const run = (attemptSeed: number): TemplateSpec => {
    let out = applyStylePack(spec, pack, profile);
    const motionPack = packByKey(profile.recommendedPackKey) ?? null;
    const amount = Math.max(1, Math.round(profile.effectBudgetMultiplier * 5));
    out = applyMotionPack(out, motionPack, amount);
    out = composeMotion(out, {
      effectAmount: amount,
      pack: motionPack,
      styleTags: profile.styleTags,
      styleKey,
      rng: mulberry32(attemptSeed),
    }).spec;
    return out;
  };

  let result = run(seed);
  if (checkStyleRepresentation(result, styleKey).status === "fail") {
    result = run(seed + 1);
  }
  return result;
}

export type { GenerateOptions };
export {
  PLATFORMS,
  DURATIONS,
  FORMATS,
  ENERGIES,
  COMPLEXITIES,
  AESTHETICS,
  PACINGS,
  TYPOGRAPHY_LEVELS,
  TRANSITION_INTENSITIES,
  LAYOUT_COMPLEXITIES,
} from "./director";

const seedNow = () => Math.floor(Math.random() * 1e9);

/** Four genuinely different creative solutions to the same brief. */
export function generateTemplates(opts: GenerateOptions, count = 4): TemplateSpec[] {
  const seed = opts.seed ?? seedNow();
  const rng = mulberry32(seed);
  const concepts = chooseConcepts(opts, count, rng);
  return concepts.map((concept, i) => {
    const shotSeed = seed + i * 104729;
    return applyStyleToSpec(composeConcept(concept, opts, shotSeed), opts.styleKey, shotSeed);
  });
}

/** ~70% of the DNA preserved: same concept, same rhythm, font and surprise. */
export function regenerateSimilar(
  spec: TemplateSpec,
  opts: GenerateOptions,
  count = 4,
): TemplateSpec[] {
  const concept = conceptByKey(spec.direction?.conceptKey ?? CONCEPTS[0]!.key);
  const seed = opts.seed ?? seedNow();
  return Array.from({ length: count }, (_, i) => {
    const shotSeed = seed + i * 7907;
    const rng = mulberry32(shotSeed);
    const fresh = buildDirection(concept, opts, rng);
    const direction: CreativeDirection = spec.direction
      ? {
          ...spec.direction,
          // keep the idea, vary the execution details
          conceptName: spec.direction.conceptName,
          surpriseAt: 0.42 + rng() * 0.34,
          textureKeys: rng() < 0.5 ? spec.direction.textureKeys : fresh.textureKeys,
          rhythmKey: rng() < 0.75 ? spec.direction.rhythmKey : fresh.rhythmKey,
          fontKey: rng() < 0.8 ? spec.direction.fontKey : fresh.fontKey,
          surpriseKind: rng() < 0.7 ? spec.direction.surpriseKind : fresh.surpriseKind,
        }
      : fresh;
    const built = composeConcept(
      concept,
      { ...opts, duration: spec.duration, format: opts.format },
      shotSeed,
      direction,
      `${direction.conceptName} ${String.fromCharCode(65 + i)}`,
    );
    return applyStyleToSpec(built, opts.styleKey, shotSeed);
  });
}

/** ~30% preserved: keeps the brief and one motif, deliberately explores elsewhere. */
export function remixTemplate(
  spec: TemplateSpec,
  opts: GenerateOptions,
  count = 4,
): TemplateSpec[] {
  const seed = opts.seed ?? seedNow();
  const origin = spec.direction?.conceptKey;
  const others = CONCEPTS.filter((c) => c.key !== origin);
  return Array.from({ length: count }, (_, i) => {
    const shotSeed = seed + i * 15493;
    const rng = mulberry32(shotSeed);
    const concept = others[Math.floor(rng() * others.length)]!;
    const fresh = buildDirection(concept, opts, rng);
    const direction: CreativeDirection = {
      ...fresh,
      // the one inherited gene
      fontKey:
        rng() < 0.3
          ? (spec.fontKey ?? fresh.fontKey)
          : (fontsIn(concept.fontCategories[0]!)[0] ?? FONTS[0]!).key,
      rhythmKey:
        rng() < 0.3
          ? (spec.direction?.rhythmKey ?? fresh.rhythmKey)
          : RHYTHMS[Math.floor(rng() * RHYTHMS.length)]!.key,
    };
    const built = composeConcept(
      concept,
      { ...opts, duration: spec.duration, risk: Math.min(10, (opts.risk ?? 4) + 3) },
      shotSeed,
      direction,
    );
    return applyStyleToSpec(built, opts.styleKey, shotSeed);
  });
}
