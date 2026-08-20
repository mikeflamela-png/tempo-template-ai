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
  const seed = seedNow();
  const rng = mulberry32(seed);
  const concepts = chooseConcepts(opts, count, rng);
  return concepts.map((concept, i) => composeConcept(concept, opts, seed + i * 104729));
}

/** ~70% of the DNA preserved: same concept, same rhythm, font and surprise. */
export function regenerateSimilar(
  spec: TemplateSpec,
  opts: GenerateOptions,
  count = 4,
): TemplateSpec[] {
  const concept = conceptByKey(spec.direction?.conceptKey ?? CONCEPTS[0]!.key);
  const seed = seedNow();
  return Array.from({ length: count }, (_, i) => {
    const rng = mulberry32(seed + i * 7907);
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
    return composeConcept(
      concept,
      { ...opts, duration: spec.duration, format: opts.format },
      seed + i * 7907,
      direction,
      `${direction.conceptName} ${String.fromCharCode(65 + i)}`,
    );
  });
}

/** ~30% preserved: keeps the brief and one motif, deliberately explores elsewhere. */
export function remixTemplate(
  spec: TemplateSpec,
  opts: GenerateOptions,
  count = 4,
): TemplateSpec[] {
  const seed = seedNow();
  const origin = spec.direction?.conceptKey;
  const others = CONCEPTS.filter((c) => c.key !== origin);
  return Array.from({ length: count }, (_, i) => {
    const rng = mulberry32(seed + i * 15493);
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
    return composeConcept(
      concept,
      { ...opts, duration: spec.duration, risk: Math.min(10, (opts.risk ?? 4) + 3) },
      seed + i * 15493,
      direction,
    );
  });
}
