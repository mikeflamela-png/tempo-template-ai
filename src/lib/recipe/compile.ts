/**
 * RECIPE COMPILER
 *
 * Turns a CreativeRecipe into real TemplateSpecs.
 *
 * Rules (in priority order, highest first):
 *   1. locked manual edits (carried on the inherited spec)
 *   2. strict-recipe constraints
 *   3. explicit user selections (state === "custom")
 *   4. brand rules
 *   5. recipe rules
 *   6. inherited current edit
 *   7. taste / auto intelligence
 *   8. novelty
 *
 * Everything the user left on AUTO becomes a variation dimension: the lanes
 * below only ever change AUTO material, never a specified section.
 */
import type { CreativeRecipe, SectionKey } from "./types";
import { autoSections } from "./types";
import type {
  AudioTrack,
  MotionAssetEvent,
  TemplateSpec,
  TextSlot,
} from "@/lib/template/types";
import {
  generateTemplates,
  regenerateSimilar,
  remixTemplate,
  type GenerateOptions,
} from "@/lib/template/generate";
import { applyStylePack, stylePackByKey } from "@/lib/template/stylepacks";
import { applyMotionPack, packByKey } from "@/lib/motion/packs";
import { composeMotion } from "@/lib/motion/compose";
import { restraintPass } from "@/lib/template/restraint";
import { applyBrand } from "@/lib/brand/apply";
import { applyTypeSystems, typeSystemsForBrand } from "@/lib/brand/typesystems";
import { appendEndCard, endCardsForBrand } from "@/lib/brand/endcards";
import { brandById, copyKitById, type BrandKit, type CopyKit } from "@/lib/brand/store";
import { allBlueprints, applyBlueprint, blueprintById } from "@/lib/blueprint/library";
import { SIMPLE_STYLES, simpleStyleByKey } from "@/lib/template/simplestyles";
import { motionAssetById } from "@/lib/motion/assets";
import { syncSpecToTrack } from "@/lib/template/sync";
import { fontByKey } from "@/lib/template/fonts";

export interface Lane {
  key: string;
  label: string;
  description: string;
  energy?: string;
  pacing?: string;
  typography?: string;
  layoutComplexity?: string;
  transitionIntensity?: string;
  effectDelta: number;
  riskDelta: number;
}

export const RECIPE_LANES: Lane[] = [
  {
    key: "product_first",
    label: "Product first",
    description: "Faster opening, shorter shots, clean resolve.",
    typography: "Minimal",
    layoutComplexity: "Full Screen",
    transitionIntensity: "Mostly Cuts",
    effectDelta: -2,
    riskDelta: -1,
  },
  {
    key: "lifestyle_build",
    label: "Lifestyle build",
    description: "Movement-led, longer middle, hero resolve.",
    pacing: "Slow",
    effectDelta: 0,
    riskDelta: 1,
  },
  {
    key: "type_hook",
    label: "Type hook",
    description: "Copy-first opener, stronger typography.",
    typography: "Heavy",
    effectDelta: -1,
    riskDelta: 0,
  },
  {
    key: "movement_hook",
    label: "Movement hook",
    description: "Motion-led opening, looser rhythm, more treatment.",
    pacing: "Fast",
    energy: "Playful",
    transitionIntensity: "Creative",
    effectDelta: 1,
    riskDelta: 2,
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const PACING_LABEL: Record<string, string> = {
  slow: "Slow",
  medium: "Medium",
  fast: "Fast",
  dynamic: "Dynamic",
};

const SHOT_SECONDS: Record<string, number> = {
  micro: 0.45,
  short: 0.8,
  medium: 1.4,
  long: 2.4,
};

export interface RecipeContext {
  audio?: AudioTrack | null;
  /** inherit from an existing edit instead of generating fresh */
  base?: TemplateSpec | null;
  /** dimensions the user chose to CHANGE when branching from an edit */
  change?: SectionKey[];
}

export interface RecipeVersion {
  spec: TemplateSpec;
  seed: number;
  laneKey: string;
  label: string;
  description: string;
}

/* -------------------------------------------------------------- constraints */

/** Hard duration: rescale the whole timeline so the edit is exactly N seconds. */
export function enforceDuration(spec: TemplateSpec, duration: number): TemplateSpec {
  if (!duration || Math.abs(spec.duration - duration) < 0.01) return spec;
  const k = duration / spec.duration;
  const s = (n: number) => Number((n * k).toFixed(3));
  return {
    ...spec,
    duration,
    mediaSlots: spec.mediaSlots.map((m) => ({ ...m, start: s(m.start), duration: s(m.duration) })),
    textSlots: spec.textSlots.map((t) => ({ ...t, start: s(t.start), duration: s(t.duration) })),
    overlays: spec.overlays.map((o) => ({ ...o, start: s(o.start), duration: s(o.duration) })),
    graphicSlots: (spec.graphicSlots ?? []).map((g) => ({
      ...g,
      start: s(g.start),
      duration: s(g.duration),
    })),
    creativeEvents: (spec.creativeEvents ?? []).map((e) => ({
      ...e,
      start: s(e.start),
      duration: s(e.duration),
    })),
    motionAssets: (spec.motionAssets ?? []).map((e) => ({
      ...e,
      start: s(e.start),
      duration: s(e.duration),
    })),
    beatMarkers: spec.beatMarkers.map(s),
  };
}

/** Locked per-shot durations; AUTO shots absorb the difference. */
export function enforceShotDurations(
  spec: TemplateSpec,
  fixed: Record<number, number>,
): TemplateSpec {
  const entries = Object.entries(fixed).filter(([, v]) => v > 0.05);
  if (!entries.length) return spec;
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  const lockedIdx = new Set(entries.map(([i]) => Number(i)));
  const lockedTotal = entries.reduce((a, [, v]) => a + v, 0);
  const autoSlots = slots.filter((_, i) => !lockedIdx.has(i));
  const autoTotal = autoSlots.reduce((a, s) => a + s.duration, 0) || 1;
  const remaining = Math.max(0.4, spec.duration - lockedTotal);
  let t = 0;
  const next = slots.map((s, i) => {
    const dur = lockedIdx.has(i)
      ? fixed[i]!
      : Math.max(0.25, (s.duration / autoTotal) * remaining);
    const out = { ...s, start: Number(t.toFixed(3)), duration: Number(dur.toFixed(3)) };
    t += dur;
    return out;
  });
  return enforceDuration({ ...spec, mediaSlots: next, duration: t }, spec.duration);
}

/** Average shot length target — real retiming, not a label. */
export function enforceShotLength(spec: TemplateSpec, seconds: number): TemplateSpec {
  const target = Math.max(0.3, seconds);
  const count = Math.max(2, Math.round(spec.duration / target));
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  if (count === slots.length) return spec;
  const out: TemplateSpec["mediaSlots"] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const src = slots[i % slots.length]!;
    out.push({
      ...src,
      id: i < slots.length ? src.id : `${src.id}-x${i}`,
      start: Number(t.toFixed(3)),
      duration: Number(target.toFixed(3)),
    });
    t += target;
  }
  return enforceDuration({ ...spec, mediaSlots: out, duration: t }, spec.duration);
}

const COPY_ROLES = ["hook", "headline", "feature", "support", "offer", "cta"] as const;

/** EXACT COPY — the strings are preserved verbatim, in reading order. */
export function enforceCopy(spec: TemplateSpec, recipe: CreativeRecipe): TemplateSpec {
  const { mode, lines } = recipe.copy.value;
  if (mode === "auto") return spec;
  if (mode === "none") return { ...spec, textSlots: [] };
  const values = COPY_ROLES.map((r) => lines[r].trim()).filter(Boolean);
  if (!values.length) return spec;
  const slots = [...spec.textSlots].sort((a, b) => a.start - b.start);
  const next: TextSlot[] = values.map((value, i) => {
    const src = slots[i] ?? slots[slots.length - 1];
    const span = spec.duration / values.length;
    return src
      ? { ...src, id: src.id ?? `copy-${i}`, value }
      : ({
          id: `copy-${i}`,
          label: COPY_ROLES[i] ?? "line",
          value,
          start: Number((i * span).toFixed(2)),
          duration: Number(Math.min(span, 2.2).toFixed(2)),
          style: "centered_statement",
          position: i === 0 ? "center" : "bottom",
        } as TextSlot);
  });
  return { ...spec, textSlots: next };
}

/** Typography constraints applied to every line. */
export function enforceType(spec: TemplateSpec, recipe: CreativeRecipe): TemplateSpec {
  if (recipe.type.state !== "custom" && !recipe.type.locked) return spec;
  const t = recipe.type.value;
  const speed =
    t.motion === "static" ? 0 : t.motion === "subtle" ? 0.6 : t.motion === "aggressive" ? 1.8 : 1;
  const font = fontByKey(t.fontKey ?? "") ?? null;
  return {
    ...spec,
    ...(font ? { fontKey: font.key } : {}),
    textSlots: spec.textSlots.map((s) => ({
      ...s,
      ...(font ? { fontKey: font.key } : {}),
      ...(t.weight ? { fontWeight: t.weight } : {}),
      ...(t.sizeScale ? { sizeScale: t.sizeScale } : {}),
      ...(t.tracking !== null ? { tracking: t.tracking } : {}),
      ...(t.position ? { position: t.position } : {}),
      ...(t.align ? { align: t.align } : {}),
      ...(t.color ? { color: t.color } : {}),
      ...(t.motion ? { animSpeed: speed } : {}),
      value: t.uppercase ? s.value.toUpperCase() : s.value,
    })),
  };
}

/** Selected motion assets must actually appear, at the chosen frequency. */
export function enforceMotion(spec: TemplateSpec, recipe: CreativeRecipe): TemplateSpec {
  const m = recipe.motion.value;
  const chosen = m.assetIds.map((id) => motionAssetById(id)).filter(Boolean);
  let events: MotionAssetEvent[] = [...(spec.motionAssets ?? [])];

  if (recipe.strict || (recipe.motion.state === "custom" && !m.supporting)) {
    // Nothing Tempo picked on its own survives.
    events = events.filter((e) => m.assetIds.includes(e.assetId));
  }

  if (chosen.length) {
    const perAsset =
      m.frequency === "once"
        ? 1
        : m.frequency === "occasionally"
          ? Math.max(1, Math.round(spec.duration / 6))
          : Math.max(2, Math.round(spec.duration / 3));
    const cuts = [...spec.mediaSlots].sort((a, b) => a.start - b.start).map((s) => s.start);
    let slot = 0;
    chosen.forEach((asset, ai) => {
      const have = events.filter((e) => e.assetId === asset!.id).length;
      for (let i = have; i < perAsset; i++) {
        const at = cuts[(slot + ai) % Math.max(1, cuts.length)] ?? 0;
        slot += 2;
        const dur = Math.min(
          Math.max(asset!.durationSec || 0.9, asset!.rules.minDuration ?? 0.4),
          Math.min(asset!.rules.maxDuration ?? 2.4, Math.max(0.4, spec.duration - at)),
        );
        events.push({
          id: `req-${asset!.id}-${Math.round(at * 1000)}-${i}`,
          assetId: asset!.id,
          label: asset!.name,
          start: Number(at.toFixed(3)),
          duration: Number(dur.toFixed(3)),
          scale: asset!.defaultScale,
          x: asset!.defaultX,
          y: asset!.defaultY,
          opacity: asset!.defaultOpacity,
          ...(asset!.blend ? { blend: asset!.blend } : {}),
          ...(asset!.loop ? { loop: true } : {}),
        });
      }
    });
  }

  // Manual placements are absolute.
  for (const p of m.placements) {
    const asset = motionAssetById(p.assetId);
    if (!asset) continue;
    events = events.filter((e) => !(e.assetId === p.assetId && Math.abs(e.start - p.start) < 0.2));
    events.push({
      id: `manual-${p.assetId}-${Math.round(p.start * 1000)}`,
      assetId: p.assetId,
      label: asset.name,
      start: p.start,
      duration: p.duration,
      scale: asset.defaultScale,
      x: asset.defaultX,
      y: asset.defaultY,
      opacity: asset.defaultOpacity,
    });
  }

  const out: TemplateSpec = { ...spec, motionAssets: events.sort((a, b) => a.start - b.start) };
  if (recipe.strict) {
    out.creativeEvents = [];
    out.graphicSlots = [];
    out.overlays = [];
  }
  return out;
}

/** Ending treatment — a real change to the last block. */
export function enforceEnding(
  spec: TemplateSpec,
  recipe: CreativeRecipe,
  brand: BrandKit | null,
): TemplateSpec {
  const ending = recipe.finish.value.ending;
  if (!ending) return spec;
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);
  const last = slots[slots.length - 1];
  if (!last) return spec;
  let out = spec;

  if (ending === "hero_hold" || ending === "lifestyle") {
    const hold = Math.min(2.2, spec.duration * 0.28);
    const trimmed = slots.slice(0, -1);
    const used = trimmed.reduce((a, s) => a + s.duration, 0);
    const scale = Math.max(0.2, (spec.duration - hold) / (used || 1));
    let t = 0;
    const next = trimmed.map((s) => {
      const d = Number((s.duration * scale).toFixed(3));
      const o = { ...s, start: Number(t.toFixed(3)), duration: d };
      t += d;
      return o;
    });
    next.push({
      ...last,
      start: Number(t.toFixed(3)),
      duration: Number(hold.toFixed(3)),
      animationDuring: ending === "hero_hold" ? "slow_push_in" : "drift",
      transitionOut: "hard_cut",
    });
    out = { ...out, mediaSlots: next };
  }

  if (ending === "cta" || ending === "logo") {
    const text = recipe.copy.value.lines.cta.trim() || (ending === "logo" ? brand?.name ?? "" : "");
    if (text) {
      const start = Math.max(0, spec.duration - 1.6);
      out = {
        ...out,
        textSlots: [
          ...out.textSlots.filter((t) => t.start < start - 0.1),
          {
            id: "ending-cta",
            label: "CTA",
            value: text,
            start,
            duration: Number((spec.duration - start).toFixed(2)),
            style: "cta_lockup",
            position: "center",
            align: "center",
            accent: true,
          },
        ],
      };
    }
  }

  if (ending === "end_card" && brand) {
    const card = endCardsForBrand(brand.id)[0];
    if (card) out = enforceDuration(appendEndCard(out, card, brand), spec.duration);
  }
  return out;
}

/* ------------------------------------------------------------------ compile */

function optionsFor(recipe: CreativeRecipe, lane: Lane): GenerateOptions {
  const style = simpleStyleByKey(recipe.style.value.styleKey) ?? SIMPLE_STYLES[0]!;
  const timing = recipe.timing.value;
  const finish = recipe.finish.value;
  const timingSpecified = recipe.timing.state === "custom" || recipe.timing.locked;
  const styleSpecified = recipe.style.state === "custom" || recipe.style.locked;
  const pacing =
    timingSpecified && timing.pacing
      ? PACING_LABEL[timing.pacing]!
      : (lane.pacing ?? style.pacing);
  return {
    prompt: recipe.brief || `${style.name} short-form edit`,
    platform: "Instagram Reels",
    duration: timing.duration,
    format: "9:16",
    energy: lane.energy ?? style.energy,
    complexity: style.complexity,
    aesthetic: "Auto",
    pacing,
    typography: lane.typography ?? style.typography,
    transitionIntensity: lane.transitionIntensity ?? style.transitionIntensity,
    layoutComplexity: lane.layoutComplexity ?? style.layoutComplexity,
    risk: clamp(
      (styleSpecified ? style.risk : style.risk) + lane.riskDelta + (finish.intensity - 4) * 0.6,
      1,
      10,
    ),
    styleKey: style.stylePackKey,
  } as GenerateOptions;
}

function blueprintFor(recipe: CreativeRecipe) {
  const { blueprintId, structureKey } = recipe.structure.value;
  if (blueprintId) return blueprintById(blueprintId);
  if (recipe.structure.state !== "custom" || !structureKey) return null;
  const hints =
    (
      [
        ["product_led", ["product", "hero"]],
        ["lifestyle_build", ["lifestyle"]],
        ["hook_product", ["hook"]],
        ["editorial", ["editorial", "fashion"]],
        ["story_build", ["story"]],
        ["montage", ["montage", "energy"]],
        ["type_led", ["type"]],
        ["problem_product", ["problem"]],
        ["slow_build", ["slow", "luxury"]],
      ] as const
    ).find(([k]) => k === structureKey)?.[1] ?? [];
  const all = allBlueprints();
  return (
    all.find((b) =>
      hints.some(
        (h) =>
          b.name.toLowerCase().includes(h) ||
          (b.tags ?? []).some((t: string) => t.toLowerCase().includes(h)),
      ),
    ) ?? null
  );
}

/** The full finishing chain — style, blueprint, brand, motion, restraint, constraints. */
export function finishSpec(
  spec: TemplateSpec,
  recipe: CreativeRecipe,
  lane: Lane,
  ctx: RecipeContext,
): TemplateSpec {
  const style = simpleStyleByKey(recipe.style.value.styleKey) ?? SIMPLE_STYLES[0]!;
  const finish = recipe.finish.value;
  const brand = brandById(recipe.brandId) ?? null;
  const copyKit: CopyKit | null = copyKitById(recipe.copyKitId) ?? null;
  const effectAmount = clamp(
    (recipe.finish.state === "custom" ? finish.effectDensity : style.effectAmount) +
      lane.effectDelta,
    0,
    10,
  );

  let out = spec;
  const pack = stylePackByKey(style.stylePackKey);
  if (pack) out = applyStylePack(out, pack);
  const bp = blueprintFor(recipe);
  if (bp) out = applyBlueprint(out, bp);
  const motionPack = packByKey(style.motionPackKey);
  out = applyMotionPack(out, motionPack, effectAmount);
  out = applyBrand(out, brand ?? undefined, copyKit ?? undefined);
  if (brand) {
    const systems = typeSystemsForBrand(brand.id);
    if (systems.length) out = applyTypeSystems(out, systems);
  }
  out = composeMotion(out, {
    effectAmount,
    source: style.creativeSource,
    pack: motionPack ?? null,
    ...(brand ? { brandId: brand.id } : {}),
    ...(pack ? { styleTags: [pack.key], styleKey: pack.key } : {}),
  }).spec;
  out = restraintPass(out, {
    effectAmount: clamp(effectAmount - (3 - Math.min(3, finish.footagePriority)), 0, 10),
  });

  // ---- hard constraints, applied last so nothing can undo them
  const timing = recipe.timing.value;
  out = enforceDuration(out, timing.duration);
  if (recipe.timing.state === "custom") {
    if (timing.shotLength) out = enforceShotLength(out, SHOT_SECONDS[timing.shotLength]!);
    out = enforceShotDurations(out, timing.shotDurations);
  }
  out = enforceCopy(out, recipe);
  out = enforceType(out, recipe);
  out = enforceEnding(out, recipe, brand);
  out = enforceMotion(out, recipe);

  const music = recipe.music.value;
  if (ctx.audio?.beatMap && music.beatSync !== "off") {
    const tight = music.beatSync === "loose" ? 0.3 : music.beatSync === "medium" ? 0.6 : 0.92;
    out = enforceDuration(syncSpecToTrack(out, ctx.audio, tight), timing.duration);
  }
  return out;
}

const hashSeed = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * Generate versions inside the recipe. Reproducible: the same recipe + seed
 * always produces the same edit.
 */
export function generateFromRecipe(
  recipe: CreativeRecipe,
  ctx: RecipeContext = {},
  baseSeed = Math.floor(Math.random() * 1e9),
): RecipeVersion[] {
  const lanes = RECIPE_LANES.slice(0, Math.max(1, recipe.count));
  const distance = recipe.variation;
  const auto = new Set<SectionKey>(autoSections(recipe));
  const changing = ctx.change ? new Set(ctx.change) : null;

  return lanes.map((lane, i) => {
    const seed = baseSeed + i * 104729;
    const laneOpts = { ...optionsFor(recipe, lane), seed };
    let spec: TemplateSpec;
    if (ctx.base) {
      // Branch from the current edit rather than the prompt.
      const wide = distance === "wild";
      spec = (wide ? remixTemplate : regenerateSimilar)(ctx.base, laneOpts, 1)[0]!;
      if (distance === "tight") {
        // keep the inherited identity, vary only structure-level material
        spec = { ...spec, palette: ctx.base.palette, fontKey: ctx.base.fontKey ?? spec.fontKey };
      }
      // dimensions NOT selected under CHANGE inherit from the edit
      if (changing) {
        if (!changing.has("copy")) spec = { ...spec, textSlots: ctx.base.textSlots };
        if (!changing.has("motion"))
          spec = {
            ...spec,
            motionAssets: ctx.base.motionAssets ?? [],
            graphicSlots: ctx.base.graphicSlots ?? [],
          };
        if (!changing.has("timing")) spec = { ...spec, mediaSlots: ctx.base.mediaSlots };
      }
    } else {
      spec = generateTemplates(laneOpts, 1)[0]!;
    }

    const finished = finishSpec(spec, recipe, lane, ctx);
    const id = `${recipe.id}-${lane.key}-${hashSeed(`${seed}`).toString(36)}`;
    return {
      spec: {
        ...finished,
        id,
        name: lane.label,
        tags: [...new Set([...finished.tags, lane.label])],
      },
      seed,
      laneKey: lane.key,
      label: String.fromCharCode(65 + i),
      description: describeLane(lane, recipe, auto),
    };
  });
}

function describeLane(lane: Lane, recipe: CreativeRecipe, auto: Set<SectionKey>): string {
  const bits = [lane.description];
  if (!auto.has("timing")) bits.push(`${recipe.timing.value.duration}s locked`);
  if (!auto.has("style"))
    bits.push(simpleStyleByKey(recipe.style.value.styleKey)?.name ?? "chosen style");
  return bits.join(" • ");
}

/** Plain-language summary of what the user pinned down. */
export function recipeSummary(recipe: CreativeRecipe): string[] {
  const out: string[] = [];
  const t = recipe.timing.value;
  out.push(`${t.duration}s`);
  const style = simpleStyleByKey(recipe.style.value.styleKey);
  if (recipe.style.state === "custom" && style) out.push(style.name);
  if (recipe.timing.state === "custom" && t.pacing) out.push(`${PACING_LABEL[t.pacing]} pacing`);
  if (recipe.copy.state === "custom") {
    const mode = recipe.copy.value.mode;
    out.push(mode === "exact" ? "Exact copy" : mode === "none" ? "No copy" : "Assisted copy");
  }
  if (recipe.type.state === "custom") {
    const f = fontByKey(recipe.type.value.fontKey ?? "");
    out.push(recipe.type.value.useBrandKit ? "Brand type" : f ? f.name : "Custom type");
  }
  if (recipe.structure.state === "custom" && recipe.structure.value.structureKey)
    out.push(recipe.structure.value.structureKey.replace(/_/g, " "));
  if (recipe.motion.state === "custom" && recipe.motion.value.assetIds.length) {
    const names = recipe.motion.value.assetIds
      .map((id) => motionAssetById(id)?.name)
      .filter(Boolean)
      .slice(0, 2);
    out.push(`${names.join(" + ")} ×${recipe.motion.value.frequency}`);
  }
  if (recipe.music.state === "custom" && recipe.music.value.beatSync !== "off")
    out.push(`${recipe.music.value.beatSync} beat sync`);
  if (recipe.finish.state === "custom" && recipe.finish.value.ending)
    out.push(recipe.finish.value.ending.replace(/_/g, " ") + " ending");
  if (recipe.strict) out.push("Strict recipe");
  return out;
}

/** What Tempo is still free to decide. */
export function tempoWillDecide(recipe: CreativeRecipe): string[] {
  const auto = new Set(autoSections(recipe));
  const out: string[] = [];
  if (auto.has("footage")) out.push("Footage selection & shot order");
  if (auto.has("structure")) out.push("Edit structure & opening");
  if (auto.has("timing")) out.push("Shot durations & pacing");
  if (auto.has("copy")) out.push("Copy lines & placement");
  if (auto.has("type")) out.push("Typography treatment");
  if (auto.has("style")) out.push("Overall treatment");
  if (auto.has("motion") && !recipe.strict) out.push("Motion placement & supporting effects");
  if (auto.has("music")) out.push("Beat behaviour");
  if (auto.has("finish")) out.push("Effect density & ending");
  return out;
}
