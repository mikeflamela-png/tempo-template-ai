/**
 * VARIATION MATRIX + KEEP/CHANGE + BRAND SWAP
 *
 * All of these regenerate a TemplateSpec by mutating explicit dimensions of
 * its DNA while leaving everything else byte-for-byte identical. They never
 * go back through the concept/director pipeline — they edit the spec.
 */
import type {
  Animation,
  MediaSlot,
  TemplateSpec,
  TextSlot,
  Transition,
} from "@/lib/template/types";
import { ANIMATIONS, TRANSITIONS } from "@/lib/template/types";
import { mulberry32, type Rng } from "@/lib/template/director";
import { FONTS, fontByKey, fontsIn } from "@/lib/template/fonts";
import { allBlueprints, applyBlueprint, blueprintById, type Blueprint } from "@/lib/blueprint/library";
import type { BrandKit, CopyKit } from "@/lib/brand/store";
import { applyBrand } from "@/lib/brand/apply";

export type VariationDimension =
  | "hook"
  | "headline"
  | "cta"
  | "footage"
  | "blueprint"
  | "pacing"
  | "motion_kit"
  | "motion_slots"
  | "opening"
  | "ending"
  | "music"
  | "type_system";

export const VARIATION_DIMENSIONS: VariationDimension[] = [
  "hook",
  "headline",
  "cta",
  "footage",
  "blueprint",
  "pacing",
  "motion_kit",
  "motion_slots",
  "opening",
  "ending",
  "music",
  "type_system",
];

export const DIMENSION_LABEL: Record<VariationDimension, string> = {
  hook: "Hook",
  headline: "Headline",
  cta: "CTA",
  footage: "Footage assignment",
  blueprint: "Blueprint",
  pacing: "Pacing",
  motion_kit: "Motion kit",
  motion_slots: "Motion slots",
  opening: "Opening",
  ending: "Ending",
  music: "Music",
  type_system: "Type system",
};

export interface VariationContext {
  dimensions: VariationDimension[];
  counts: Partial<Record<VariationDimension, number>>;
  brand?: BrandKit | null | undefined;
  copy?: CopyKit | null | undefined;
  blueprintIds?: string[] | undefined;
  seed?: number | undefined;
}

/* ------------------------------------------------------------ copy pools */

const HOOK_ALTS = [
  "STOP SCROLLING",
  "WATCH THIS FIRST",
  "THIS CHANGES IT",
  "MEET THE NEW ONE",
  "YOU NEED THIS",
  "MADE DIFFERENT",
  "BEFORE YOU BUY",
];
const HEADLINE_ALTS = [
  "LIGHTER. FASTER.",
  "BUILT TO LAST",
  "ENGINEERED FOR YOU",
  "ALL DAY COMFORT",
  "DESIGNED DIFFERENT",
  "FEEL THE DIFFERENCE",
];
const CTA_ALTS = [
  "SHOP NOW",
  "TAP TO SHOP",
  "GET YOURS",
  "AVAILABLE NOW",
  "EXPLORE THE RANGE",
  "LEARN MORE",
];

function altsForCopy(base: string, pool: string[], extra: string[]): string[] {
  const all = [...extra.filter((v) => v.trim()), ...pool].filter((v) => v.toUpperCase() !== base.toUpperCase());
  return all.length ? all : pool;
}

function findTextSlot(spec: TemplateSpec, label: string, styles: string[]): TextSlot | undefined {
  return spec.textSlots.find(
    (t) => t.label.toUpperCase() === label || styles.includes(t.style),
  );
}

/* -------------------------------------------------------------- mutators */

function mutateHook(spec: TemplateSpec, rng: Rng, ctx: VariationContext): TemplateSpec {
  const slot = findTextSlot(spec, "HOOK", ["oversized_hook", "kinetic_words", "giant_word"]);
  if (!slot) return spec;
  const alts = altsForCopy(slot.value, HOOK_ALTS, ctx.copy ? [ctx.copy.hook] : []);
  const value = alts[Math.floor(rng() * alts.length)]!;
  return {
    ...spec,
    textSlots: spec.textSlots.map((t) => (t.id === slot.id ? { ...t, value } : t)),
  };
}

function mutateHeadline(spec: TemplateSpec, rng: Rng, ctx: VariationContext): TemplateSpec {
  const slot = findTextSlot(spec, "HEADLINE", ["feature_callout", "stat_callout", "centered_statement"]);
  if (!slot) return spec;
  const alts = altsForCopy(slot.value, HEADLINE_ALTS, ctx.copy ? [ctx.copy.headline, ctx.copy.feature] : []);
  const value = alts[Math.floor(rng() * alts.length)]!;
  return {
    ...spec,
    textSlots: spec.textSlots.map((t) => (t.id === slot.id ? { ...t, value } : t)),
  };
}

function mutateCta(spec: TemplateSpec, rng: Rng, ctx: VariationContext): TemplateSpec {
  const slot = findTextSlot(spec, "CTA", ["cta_lockup"]);
  if (!slot) return spec;
  const alts = altsForCopy(slot.value, CTA_ALTS, ctx.copy ? [ctx.copy.cta, ...ctx.copy.extras] : []);
  const value = alts[Math.floor(rng() * alts.length)]!;
  return {
    ...spec,
    textSlots: spec.textSlots.map((t) => (t.id === slot.id ? { ...t, value } : t)),
  };
}

/** Reshuffles which purposes/labels land on which slot in the spine, keeping timing. */
function mutateFootage(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const spine = spec.mediaSlots.filter((s) => s.layout === "full");
  if (spine.length < 2) return spec;
  const purposes = spine.map((s) => s.purpose);
  for (let i = purposes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [purposes[i], purposes[j]] = [purposes[j]!, purposes[i]!];
  }
  let k = 0;
  const mediaSlots = spec.mediaSlots.map((s) =>
    s.layout === "full" ? { ...s, purpose: purposes[k++]! } : s,
  );
  return { ...spec, mediaSlots };
}

function mutateBlueprint(spec: TemplateSpec, rng: Rng, ctx: VariationContext): TemplateSpec {
  const pool = (ctx.blueprintIds?.length ? ctx.blueprintIds.map((id) => blueprintById(id)) : allBlueprints()).filter(
    (b): b is Blueprint => !!b && b.id !== spec.blueprintId,
  );
  if (!pool.length) return spec;
  const blueprint = pool[Math.floor(rng() * pool.length)]!;
  return { ...applyBlueprint(spec, blueprint), blueprintId: blueprint.id };
}

/** Retimes the spine: redistributes duration across shots with a new rhythm. */
function mutatePacing(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const spine = spec.mediaSlots
    .filter((s) => s.layout === "full")
    .sort((a, b) => a.start - b.start);
  if (spine.length < 2) return spec;
  const others = spec.mediaSlots.filter((s) => s.layout !== "full");
  const shape = 0.4 + rng() * 1.6; // <1 front-loaded, >1 back-loaded
  const raw = spine.map((_, i) => Math.pow((i + 1) / spine.length, shape) - Math.pow(i / spine.length, shape));
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  const newSpine: MediaSlot[] = spine.map((s, i) => {
    const duration = Math.max(0.25, Number(((raw[i]! / total) * spec.duration).toFixed(2)));
    const start = Number(t.toFixed(2));
    t += duration;
    return { ...s, start, duration };
  });
  // clamp last one to total duration
  const last = newSpine[newSpine.length - 1];
  if (last) last.duration = Number(Math.max(0.25, spec.duration - last.start).toFixed(2));
  return { ...spec, mediaSlots: [...newSpine, ...others] };
}

/** Swaps transitions + creative-event kernels for a different motion feel. */
function mutateMotionKit(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const pickTransition = (): Transition => TRANSITIONS[Math.floor(rng() * TRANSITIONS.length)]!;
  const pickAnim = (): Animation => ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)]!;
  const mediaSlots = spec.mediaSlots.map((s) =>
    s.transitionOut
      ? { ...s, transitionOut: pickTransition(), ...(s.animationIn ? { animationIn: pickAnim() } : {}) }
      : s,
  );
  const creativeEvents = spec.creativeEvents?.map((e) => ({ ...e, seed: Math.floor(rng() * 1e6) }));
  return { ...spec, mediaSlots, creativeEvents };
}

/** Reassigns motion asset placements/order without touching the shot spine. */
function mutateMotionSlots(spec: TemplateSpec, rng: Rng): TemplateSpec {
  if (!spec.motionAssets?.length) return spec;
  const shuffled = [...spec.motionAssets];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = shuffled[i]!;
    const b = shuffled[j]!;
    shuffled[i] = { ...a, start: b.start, ...(b.slotKey ? { slotKey: b.slotKey } : {}) };
    shuffled[j] = { ...b, start: a.start, ...(a.slotKey ? { slotKey: a.slotKey } : {}) };
  }
  return { ...spec, motionAssets: shuffled };
}

const OPEN_STYLES: TextSlot["style"][] = ["oversized_hook", "kinetic_words", "masked_reveal", "word_by_word"];

function mutateOpening(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const spine = [...spec.mediaSlots.filter((s) => s.layout === "full")].sort((a, b) => a.start - b.start);
  const first = spine[0];
  const mediaSlots = first
    ? spec.mediaSlots.map((s) =>
        s.id === first.id
          ? { ...s, animationIn: ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)]! }
          : s,
      )
    : spec.mediaSlots;
  const hook = findTextSlot(spec, "HOOK", ["oversized_hook", "kinetic_words", "giant_word"]);
  const textSlots = hook
    ? spec.textSlots.map((t) =>
        t.id === hook.id ? { ...t, style: OPEN_STYLES[Math.floor(rng() * OPEN_STYLES.length)]! } : t,
      )
    : spec.textSlots;
  return { ...spec, mediaSlots, textSlots };
}

const END_STYLES: TextSlot["style"][] = ["cta_lockup", "stagger_reveal", "centered_statement", "highlight_bar"];

function mutateEnding(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const spine = [...spec.mediaSlots.filter((s) => s.layout === "full")].sort((a, b) => a.start - b.start);
  const last = spine[spine.length - 1];
  const mediaSlots = last
    ? spec.mediaSlots.map((s) =>
        s.id === last.id
          ? { ...s, animationOut: ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)]! }
          : s,
      )
    : spec.mediaSlots;
  const cta = findTextSlot(spec, "CTA", ["cta_lockup"]);
  const textSlots = cta
    ? spec.textSlots.map((t) =>
        t.id === cta.id ? { ...t, style: END_STYLES[Math.floor(rng() * END_STYLES.length)]! } : t,
      )
    : spec.textSlots;
  return { ...spec, mediaSlots, textSlots };
}

/** No independent audio track lives on the spec — approximate a "new song
 * feel" by nudging the beat markers / cut density that the edit reads from. */
function mutateMusic(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const jitter = 0.85 + rng() * 0.3;
  const beatMarkers = spec.beatMarkers.map((b) => Number(Math.min(spec.duration, b * jitter).toFixed(2)));
  return {
    ...spec,
    beatMarkers,
    tags: [...new Set([...(spec.tags ?? []), "music-variant"])],
  };
}

function mutateTypeSystem(spec: TemplateSpec, rng: Rng): TemplateSpec {
  const category = fontByKey(spec.fontKey).category;
  const pool = fontsIn(category).length > 1 ? fontsIn(category) : FONTS;
  const options = pool.filter((f) => f.key !== spec.fontKey);
  const font = options.length ? options[Math.floor(rng() * options.length)]! : fontByKey(spec.fontKey);
  return {
    ...spec,
    fontKey: font.key,
    typeSystemIds: [font.key],
    textSlots: spec.textSlots.map((t) => {
      const { fontKey: _drop, ...rest } = t;
      return rest as typeof t;
    }),
  };
}

const MUTATORS: Record<
  VariationDimension,
  (spec: TemplateSpec, rng: Rng, ctx: VariationContext) => TemplateSpec
> = {
  hook: mutateHook,
  headline: mutateHeadline,
  cta: mutateCta,
  footage: (s, r) => mutateFootage(s, r),
  blueprint: mutateBlueprint,
  pacing: (s, r) => mutatePacing(s, r),
  motion_kit: (s, r) => mutateMotionKit(s, r),
  motion_slots: (s, r) => mutateMotionSlots(s, r),
  opening: (s, r) => mutateOpening(s, r),
  ending: (s, r) => mutateEnding(s, r),
  music: (s, r) => mutateMusic(s, r),
  type_system: (s, r) => mutateTypeSystem(s, r),
};

/* ---------------------------------------------------------------- matrix */

interface Combo {
  dims: { dim: VariationDimension; index: number }[];
}

function crossProduct(dimensions: VariationDimension[], counts: Partial<Record<VariationDimension, number>>): Combo[] {
  const sizes = dimensions.map((d) => Math.max(1, counts[d] ?? 1));
  const total = sizes.reduce((a, b) => a * b, 1);
  const combos: Combo[] = [];
  const capped = Math.min(total, 16);
  for (let n = 0; n < capped; n++) {
    let rem = n;
    const dims = dimensions.map((dim, i) => {
      const size = sizes[i]!;
      const index = rem % size;
      rem = Math.floor(rem / size);
      return { dim, index };
    });
    combos.push({ dims });
  }
  return combos;
}

function labelFor(dims: { dim: VariationDimension; index: number }[]) {
  return dims.map(({ dim, index }) => `${DIMENSION_LABEL[dim]} ${index + 1}`).join(" · ");
}

/** Cross-product variants across the chosen dimensions, capped at ~16. */
export function buildVariations(base: TemplateSpec, ctx: VariationContext): TemplateSpec[] {
  const dimensions = ctx.dimensions.length ? ctx.dimensions : VARIATION_DIMENSIONS.slice(0, 1);
  const combos = crossProduct(dimensions, ctx.counts);
  const seed = ctx.seed ?? Math.floor(Math.random() * 1e9);

  return combos.map((combo, comboIdx) => {
    let spec = base;
    for (const { dim, index } of combo.dims) {
      const rng = mulberry32(seed + hashDim(dim) + index * 97 + comboIdx * 13);
      spec = MUTATORS[dim](spec, rng, ctx);
    }
    const label = labelFor(combo.dims);
    return {
      ...spec,
      id: `${base.id}-var-${comboIdx + 1}-${seed}`,
      parentId: base.id,
      versionLabel: label,
      tags: [...new Set([...(spec.tags ?? []), "variation", ...combo.dims.map((d) => d.dim)])],
    };
  });
}

function hashDim(dim: string) {
  let h = 0;
  for (let i = 0; i < dim.length; i++) h = (h * 31 + dim.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Regenerates only the unchecked (changed) dimensions; kept ones stay identical. */
export function keepChangeVariant(
  base: TemplateSpec,
  keep: Partial<Record<VariationDimension, boolean>>,
  ctx: Omit<VariationContext, "dimensions" | "counts">,
): TemplateSpec {
  const seed = ctx.seed ?? Math.floor(Math.random() * 1e9);
  const changeDims = VARIATION_DIMENSIONS.filter((d) => !keep[d]);
  let spec = base;
  for (const dim of changeDims) {
    const rng = mulberry32(seed + hashDim(dim));
    spec = MUTATORS[dim](spec, rng, { ...ctx, dimensions: changeDims, counts: {} });
  }
  return {
    ...spec,
    id: `${base.id}-keep-${seed}`,
    parentId: base.id,
    versionLabel: `Like this, changed: ${changeDims.map((d) => DIMENSION_LABEL[d]).join(", ") || "nothing"}`,
    tags: [...new Set([...(spec.tags ?? []), "keep-change"])],
  };
}

/**
 * Replaces one brand's identity with another while preserving blueprint,
 * rhythm and timing: colors, fonts, copy and end-card/logo references swap,
 * text sizes adapt when the new copy is longer or shorter.
 */
export function brandSwap(
  base: TemplateSpec,
  _fromKit: BrandKit | null | undefined,
  toKit: BrandKit,
  toCopy: CopyKit | null | undefined,
): TemplateSpec {
  let next = applyBrand({ ...base }, toKit, toCopy ?? undefined);

  // adapt text sizes when the new copy is longer/shorter than the old lines
  next = {
    ...next,
    textSlots: next.textSlots.map((t) => {
      const oldSlot = base.textSlots.find((o) => o.label === t.label);
      if (!oldSlot || oldSlot.value.length === 0) return t;
      const ratio = oldSlot.value.length / Math.max(1, t.value.length);
      const scale = Math.max(0.6, Math.min(1.4, ratio));
      if (Math.abs(scale - 1) < 0.08) return t;
      return { ...t, sizeScale: Number(((t.sizeScale ?? 1) * scale).toFixed(2)) };
    }),
  };

  const endcard = toKit.assets.find((a) => a.kind === "endcard" && a.rule !== "rare");
  const logo = toKit.assets.find((a) => a.kind === "logo");
  next = {
    ...next,
    ...(endcard?.id ?? logo?.id ?? next.endCardId
      ? { endCardId: (endcard?.id ?? logo?.id ?? next.endCardId) as string }
      : {}),
    parentId: base.id,
    versionLabel: `Brand swap → ${toKit.name}`,
    tags: [...new Set([...(next.tags ?? []), "brand-swap"])],
  };
  return next;
}
