import type {
  Animation,
  CreativeDirection,
  Layout,
  MediaSlot,
  Overlay,
  OverlayType,
  Purpose,
  SurpriseKind,
  TemplateSpec,
  TextSlot,
  TextStyleName,
  Transition,
} from "./types";
import { validateSpec } from "./types";
import { CONCEPTS, conceptByKey, type Concept } from "./concepts";
import { LAYOUT_GROUPS, type LayoutGroupKey } from "./layouts";
import { RHYTHMS, rhythmByKey } from "./rhythm";
import { FONTS, fontByKey, fontsIn } from "./fonts";
import { noveltyScore, pickNovel, remember } from "./novelty";
import { planCreativeMoments } from "@/lib/creative/plan";

/* ------------------------------------------------------------------ options */

export const PLATFORMS = ["Instagram / Reels", "TikTok", "Meta Ads", "YouTube Shorts"];
export const DURATIONS = [6, 8, 10, 12, 15, 20, 30];
export const FORMATS = ["9:16", "1:1", "4:5", "16:9"];
export const ENERGIES = ["Minimal", "Cinematic", "Energetic", "Aggressive", "Playful"];
export const COMPLEXITIES = ["Simple", "Creative", "Experimental"];

export const AESTHETICS = [
  "Auto",
  "Clean",
  "Editorial",
  "Cinematic",
  "Raw",
  "Retro",
  "Fashion",
  "Sport",
  "Luxury",
  "Playful",
  "Experimental",
];
export const PACINGS = ["Slow", "Medium", "Fast", "Very Fast", "Dynamic"];
export const TYPOGRAPHY_LEVELS = ["None", "Minimal", "Moderate", "Heavy"];
export const TRANSITION_INTENSITIES = ["Mostly Cuts", "Subtle", "Creative", "Aggressive"];
export const LAYOUT_COMPLEXITIES = ["Full Screen", "Occasional Layouts", "Dynamic Layouts"];

export interface GenerateOptions {
  prompt: string;
  platform: string;
  duration: number;
  format: string;
  energy: string;
  complexity: string;
  aesthetic?: string;
  pacing?: string;
  typography?: string;
  transitionIntensity?: string;
  layoutComplexity?: string;
  /** 1 (safe) → 10 (weird) */
  risk?: number;
}

const FORMAT_SIZE: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "16:9": [1920, 1080],
};

const PACING_DENSITY: Record<string, number> = {
  Slow: 0.55,
  Medium: 0.85,
  Fast: 1.15,
  "Very Fast": 1.5,
  Dynamic: 1.1,
};

const ENERGY_DENSITY: Record<string, number> = {
  Minimal: 0.7,
  Cinematic: 0.75,
  Energetic: 1.15,
  Aggressive: 1.4,
  Playful: 1.05,
};

export const PALETTES = [
  { bg: "#0b0b0c", ink: "#f7f4ef", accent: "#ff5722" },
  { bg: "#efe9df", ink: "#17150f", accent: "#c2410c" },
  { bg: "#08090c", ink: "#ffffff", accent: "#7dd3fc" },
  { bg: "#f5f3ee", ink: "#111111", accent: "#111111" },
  { bg: "#0d0f08", ink: "#f2ffd6", accent: "#d7ff36" },
  { bg: "#0f0a12", ink: "#ffeede", accent: "#ff2d6f" },
];

/* ---------------------------------------------------------------- utilities */

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

const HOOKS = [
  "STOP SCROLLING",
  "BUILT TO MOVE",
  "THIS CHANGES IT",
  "MEET THE NEW ONE",
  "YOU'LL FEEL IT",
  "MADE DIFFERENT",
];
const BENEFITS = [
  "LIGHTER. FASTER.",
  "ALL DAY COMFORT",
  "ENGINEERED LIGHT",
  "ZERO BREAK-IN",
  "GRIP THAT HOLDS",
];
const PROOFS = ["10,000 5-STAR REVIEWS", "40% MORE REBOUND", "WORN BY 1M PEOPLE", "500 MILES TESTED"];
const CTAS = ["SHOP NOW", "TAP TO SHOP", "AVAILABLE NOW", "GET YOURS", "EXPLORE THE RANGE"];
const SUFFIX = ["EDIT", "CUT", "REEL", "SET", "STUDY", "RUN", "PASS", "BUILD"];

const SURPRISE_COPY: Record<SurpriseKind, string> = {
  split_screen: "a sudden split screen appears for a single beat",
  freeze_frame: "the edit freezes on one frame mid-motion",
  typography_takeover: "typography takes the whole frame for one beat",
  three_shot_burst: "three simultaneous vertical clips flash on screen",
  layout_collapse: "the layout collapses into a single frame",
  film_strip: "a temporary film strip of three frames",
  unexpected_pause: "an unexpected long hold breaks the rhythm",
  frame_within_frame: "a frame appears inside the frame",
  giant_word: "one giant word covers the image",
  abrupt_scale: "an abrupt scale change snaps the frame",
};

/* ------------------------------------------------------- creative direction */

export function chooseConcepts(opts: GenerateOptions, count: number, rng: Rng): Concept[] {
  const p = opts.prompt.toLowerCase();
  const aesthetic = opts.aesthetic && opts.aesthetic !== "Auto" ? opts.aesthetic : null;

  const scored = CONCEPTS.map((c) => {
    let s = rng() * 0.8;
    if (aesthetic && c.aesthetics.includes(aesthetic)) s += 1.8;
    if (c.aesthetics.includes(opts.energy === "Aggressive" ? "Sport" : opts.energy)) s += 0.4;
    if (/lux|premium|elegan|fashion/.test(p) && ["lux_slow", "editorial_product"].includes(c.key)) s += 1;
    if (/fast|punch|energetic|hype|sport|run/.test(p) && ["micro_burst", "kinetic_trail"].includes(c.key)) s += 1;
    if (/type|text|caption|word/.test(p) && c.key === "type_takeover") s += 1;
    if (/film|retro|vhs|analog|grain/.test(p) && ["film_contact", "raw_camcorder"].includes(c.key)) s += 1;
    if (/ad|convert|offer|sale|proof|review/.test(p) && c.key === "proof_stack") s += 1;
    if (/editorial|minimal|clean|whitespace/.test(p) && ["editorial_product", "grid_system"].includes(c.key)) s += 0.9;
    if (/collage|layer|paste|sticker/.test(p) && c.key === "collage_cut") s += 1;
    // novelty: strongly prefer concepts we have not used lately
    s += noveltyScore({ concepts: c.key }) * 1.6;
    return { c, s };
  }).sort((a, b) => b.s - a.s);

  // enforce diversity: never return two concepts with the same layout motif
  const out: Concept[] = [];
  const motifs = new Set<string>();
  for (const { c } of scored) {
    if (out.length >= count) break;
    if (motifs.has(c.layoutMotif)) continue;
    motifs.add(c.layoutMotif);
    out.push(c);
  }
  while (out.length < count) out.push(scored[out.length % scored.length]!.c);
  out.forEach((c) => remember("concepts", c.key));
  return out;
}

export function buildDirection(concept: Concept, opts: GenerateOptions, rng: Rng): CreativeDirection {
  const risk = opts.risk ?? 4;
  const rhythmPool = RHYTHMS.filter((r) => concept.rhythms.includes(r.key));
  const rhythm =
    risk >= 8 && rng() < 0.4
      ? pickNovel("rhythms", RHYTHMS, (r) => r.key, rng)
      : pickNovel("rhythms", rhythmPool, (r) => r.key, rng);

  const fontPool = concept.fontCategories.flatMap((c) => fontsIn(c));
  const font =
    risk >= 9 && rng() < 0.35
      ? pickNovel("fonts", FONTS, (x) => x.key, rng)
      : pickNovel("fonts", fontPool, (x) => x.key, rng);

  const surprise = pickNovel("motifs", concept.surprises, (s) => s, rng) as SurpriseKind;
  const surpriseAt = 0.45 + rng() * 0.3;

  const textureCount = risk >= 7 ? 3 : risk >= 4 ? 2 : 1;
  const textures = concept.textures.slice(0, textureCount);

  const conceptName = pick(rng, concept.names);
  remember("layouts", concept.layoutGroups.join("+"));
  remember("transitions", concept.transitionMotif);

  return {
    conceptKey: concept.key,
    conceptName,
    creativeIdea: concept.idea,
    pacingStrategy: `${rhythm.label} — ${rhythm.description}`,
    visualMotif: concept.visualMotif,
    transitionMotif: concept.transitionMotif,
    typographyMotif: `${font.name} · ${concept.typographyMotif}`,
    layoutMotif: concept.layoutMotif,
    openingStrategy: concept.opening,
    middleStrategy: concept.middle,
    endingStrategy: concept.ending,
    surpriseMoment: `${SURPRISE_COPY[surprise]} around ${Math.round(surpriseAt * 100)}% through the edit`,
    surpriseKind: surprise,
    surpriseAt,
    restraintRules: concept.restraint,
    fontKey: font.key,
    rhythmKey: rhythm.key,
    textureKeys: textures,
  };
}

/* ---------------------------------------------------------- spec assembly */

function transitionSet(concept: Concept, opts: GenerateOptions): Transition[] {
  switch (opts.transitionIntensity) {
    case "Mostly Cuts":
      return ["hard_cut", "hard_cut", "hard_cut", "hard_cut", concept.transitions[1] ?? "hard_cut"];
    case "Subtle":
      return ["hard_cut", "hard_cut", "blur", "mask_wipe", concept.transitions[0]!];
    case "Aggressive":
      return [...concept.transitions, "punch_zoom", "flash", "whip", "rgb_split", "stretch"];
    case "Creative":
    default:
      return [...concept.transitions, "hard_cut"];
  }
}

function layoutMomentCount(opts: GenerateOptions) {
  switch (opts.layoutComplexity) {
    case "Full Screen":
      return 0;
    case "Dynamic Layouts":
      return 3;
    case "Occasional Layouts":
      return 1;
    default:
      return opts.complexity === "Experimental" ? 3 : opts.complexity === "Creative" ? 2 : 1;
  }
}

function textCount(concept: Concept, opts: GenerateOptions) {
  switch (opts.typography) {
    case "None":
      return 0;
    case "Minimal":
      return Math.min(2, concept.textBudget);
    case "Heavy":
      return concept.textBudget + 2;
    case "Moderate":
      return concept.textBudget;
    default:
      return opts.complexity === "Simple" ? 2 : concept.textBudget;
  }
}

export function buildSpec(
  direction: CreativeDirection,
  concept: Concept,
  opts: GenerateOptions,
  seed: number,
  nameOverride?: string,
): TemplateSpec {
  const rng = mulberry32(seed);
  const [width, height] = FORMAT_SIZE[opts.format] ?? FORMAT_SIZE["9:16"]!;
  const total = opts.duration;
  const rhythm = rhythmByKey(direction.rhythmKey);
  const risk = opts.risk ?? 4;

  const density =
    rhythm.density *
    (total / 10) *
    (PACING_DENSITY[opts.pacing ?? "Medium"] ?? 0.9) *
    (ENERGY_DENSITY[opts.energy] ?? 1);
  const n = Math.max(3, Math.min(26, Math.round(density)));
  const weights = rhythm.weights(n);

  // --- the spine: one continuous full-screen edit --------------------------
  const trans = transitionSet(concept, opts);
  const struct = concept.structure;
  const slots: MediaSlot[] = [];
  const beats: number[] = [0];
  let cursor = 0;
  let lastWasEffect = false;

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    let dur = isLast ? total - cursor : Math.max(0.24, Number((weights[i]! * total).toFixed(2)));
    if (!isLast && cursor + dur > total - 0.5) dur = Math.max(0.24, total - cursor - 0.5);
    if (dur <= 0.05) break;
    const purpose: Purpose = isLast ? "hero" : struct[i % struct.length]!;

    const animIn = pick(rng, concept.motionIn);
    // restraint: only add sustained motion when the shot can breathe
    const animDuring: Animation =
      dur > 0.9 && rng() < 0.65 ? pick(rng, concept.motionDuring) : "none";

    let out: Transition = isLast ? "hard_cut" : pick(rng, trans);
    if (lastWasEffect && out !== "hard_cut" && rng() < 0.6) out = "hard_cut";
    lastWasEffect = out !== "hard_cut";

    slots.push({
      id: `slot_${String(i + 1).padStart(2, "0")}`,
      label: isLast ? "HERO" : purpose.toUpperCase(),
      start: Number(cursor.toFixed(2)),
      duration: Number(dur.toFixed(2)),
      purpose,
      layout: "full",
      animationIn: animIn,
      animationDuring: animDuring,
      transitionOut: out,
    });
    cursor = Number((cursor + dur).toFixed(2));
    beats.push(cursor);
    if (cursor >= total - 0.05) break;
  }
  if (slots.length) {
    const last = slots[slots.length - 1]!;
    last.duration = Number(Math.max(0.3, total - last.start).toFixed(2));
    last.purpose = "hero";
    last.label = "HERO";
    last.animationIn = concept.motionIn.includes("slow_push_in") ? "slow_push_in" : "push_in";
    last.animationDuring = "slow_push_in";
    last.transitionOut = "hard_cut";
  }

  // --- authored layout moments --------------------------------------------
  const moments = layoutMomentCount(opts);
  const groups = concept.layoutGroups.filter((g) => g !== "full") as LayoutGroupKey[];
  const usedHosts = new Set<number>();
  for (let k = 0; k < moments && groups.length; k++) {
    const groupKey = groups[k % groups.length]!;
    const layouts = LAYOUT_GROUPS[groupKey] as Layout[];
    // pick a host shot in the middle third — layout moments are structural, not decorative
    const lo = Math.floor(slots.length * 0.25);
    const hi = Math.max(lo + 1, Math.floor(slots.length * 0.85));
    let hostIdx = lo + Math.floor(rng() * Math.max(1, hi - lo));
    for (let g = 0; g < slots.length && usedHosts.has(hostIdx); g++)
      hostIdx = (hostIdx + 1) % slots.length;
    const host = slots[hostIdx];
    if (!host || host.duration < 0.4) continue;
    usedHosts.add(hostIdx);
    host.layout = layouts[0]!;
    host.animationDuring = "none";
    for (let j = 1; j < layouts.length; j++) {
      slots.push({
        id: `slot_${host.id}_l${j}`,
        label: `${groupKey.toUpperCase()} ${j + 1}`,
        start: host.start,
        duration: host.duration,
        purpose: pick(rng, ["detail", "product", "lifestyle"] as Purpose[]),
        layout: layouts[j]!,
        animationIn: host.animationIn ?? "none",
        animationDuring: "none",
        transitionOut: host.transitionOut ?? "hard_cut",
      });
    }
  }

  // --- the surprise moment -------------------------------------------------
  applySurprise(direction, slots, total, rng);

  // --- typography ----------------------------------------------------------
  const tCount = Math.min(textCount(concept, opts), 6);
  const styles = concept.textStyles;
  const copy = [
    { label: "HOOK", value: pick(rng, HOOKS) },
    { label: "BENEFIT", value: pick(rng, BENEFITS) },
    { label: "PROOF", value: pick(rng, PROOFS) },
    { label: "LINE", value: pick(rng, BENEFITS) },
    { label: "LINE", value: pick(rng, PROOFS) },
  ];
  const textSlots: TextSlot[] = [];
  for (let i = 0; i < tCount; i++) {
    const isCta = i === tCount - 1;
    const start = isCta
      ? Math.max(0, total - Math.min(2.4, total * 0.26))
      : Number(((total * (i + 0.2)) / (tCount + 0.5)).toFixed(2));
    const dur = isCta
      ? total - start
      : Math.min(Math.max(0.9, total * 0.16), Math.max(0.6, total - start - 0.3));
    textSlots.push({
      id: `text_${String(i + 1).padStart(2, "0")}`,
      label: isCta ? "CTA" : copy[i]!.label,
      value: isCta ? pick(rng, CTAS) : copy[i]!.value,
      start,
      duration: Number(Math.max(0.6, dur).toFixed(2)),
      style: isCta ? "cta_lockup" : (styles[i % (styles.length - 1)] as TextStyleName),
      position: i === 0 ? "center" : isCta ? "bottom" : i % 2 ? "bottom" : "top",
      align: concept.key === "editorial_product" || concept.key === "lux_slow" ? "center" : i % 2 ? "left" : "center",
      accent: i === 0 || isCta,
    });
  }
  if (direction.surpriseKind === "typography_takeover" || direction.surpriseKind === "giant_word") {
    const at = Number((total * direction.surpriseAt).toFixed(2));
    textSlots.push({
      id: "text_surprise",
      label: "SURPRISE",
      value: pick(rng, ["NOW", "MOVE", "YES", "GO", "NEW"]),
      start: at,
      duration: Math.min(0.7, Math.max(0.4, total - at - 0.2)),
      style: "giant_word",
      position: "center",
      align: "center",
      accent: true,
    });
  }

  // --- texture / treatments ------------------------------------------------
  const overlays: Overlay[] = direction.textureKeys.map((t) => ({
    type: t as OverlayType,
    start: 0,
    duration: total,
  }));
  if (risk < 8) overlays.splice(2);
  if (!overlays.some((o) => o.type === "progress"))
    overlays.push({ type: "progress", start: 0, duration: total, accent: true });
  slots
    .filter((s) => s.transitionOut === "flash")
    .slice(0, 3)
    .forEach((s) =>
      overlays.push({
        type: "flash",
        start: Number(Math.max(0, s.start + s.duration - 0.06).toFixed(2)),
        duration: 0.12,
        accent: rng() < 0.5,
      }),
    );

  const paletteIdx = concept.paletteIdx[Math.floor(rng() * concept.paletteIdx.length)]!;

  return {
    id: `gen-${seed.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`,
    name: nameOverride ?? direction.conceptName,
    duration: total,
    fps: 30,
    width,
    height,
    tags: [conceptTag(concept), opts.platform, opts.aesthetic && opts.aesthetic !== "Auto" ? opts.aesthetic : "Product"],
    palette: PALETTES[paletteIdx]!,
    mediaSlots: slots.sort((a, b) => a.start - b.start),
    textSlots,
    overlays,
    beatMarkers: beats,
    fontKey: direction.fontKey,
    direction,
    creativeProfile: {
      family: direction.conceptName,
      energy: opts.energy,
      pacing: direction.pacingStrategy,
      typography: direction.typographyMotif,
      transitionStyle: direction.transitionMotif,
      structure: `${direction.openingStrategy} → ${direction.middleStrategy} → ${direction.endingStrategy}`,
    },
  };
}

function conceptTag(concept: Concept) {
  return concept.aesthetics[0] ?? "Product";
}

function applySurprise(
  direction: CreativeDirection,
  slots: MediaSlot[],
  total: number,
  rng: Rng,
) {
  const at = total * direction.surpriseAt;
  const spine = slots.filter((s) => s.layout === "full");
  const host =
    spine.find((s) => s.start <= at && s.start + s.duration > at) ?? spine[Math.floor(spine.length / 2)];
  if (!host) return;

  switch (direction.surpriseKind) {
    case "split_screen": {
      host.layout = "split-top";
      slots.push({
        ...host,
        id: `${host.id}_sp`,
        label: "SPLIT",
        layout: "split-bottom",
        animationIn: "slide_up",
      });
      break;
    }
    case "three_shot_burst": {
      const cols: Layout[] = ["col-1", "col-2", "col-3"];
      host.layout = cols[0]!;
      host.animationIn = "expand";
      cols.slice(1).forEach((c, i) =>
        slots.push({
          ...host,
          id: `${host.id}_b${i}`,
          label: "BURST",
          layout: c,
          animationIn: "expand",
        }),
      );
      break;
    }
    case "film_strip": {
      const strip: Layout[] = ["strip-1", "strip-2", "strip-3"];
      host.layout = strip[0]!;
      strip.slice(1).forEach((c, i) =>
        slots.push({ ...host, id: `${host.id}_f${i}`, label: "STRIP", layout: c }),
      );
      break;
    }
    case "frame_within_frame": {
      slots.push({
        ...host,
        id: `${host.id}_fw`,
        label: "INSET",
        layout: "inset",
        animationIn: "scale_bounce",
      });
      break;
    }
    case "freeze_frame":
      host.animationIn = "none";
      host.animationDuring = "freeze";
      host.transitionOut = "hard_cut";
      break;
    case "unexpected_pause":
      host.animationDuring = "slow_push_in";
      host.transitionOut = "hard_cut";
      break;
    case "layout_collapse":
      host.animationIn = "collapse";
      host.transitionOut = "collapse_frame";
      break;
    case "abrupt_scale":
      host.animationIn = "snap_zoom";
      host.transitionOut = "punch_zoom";
      break;
    default:
      break;
  }
  void rng;
}

/* ---------------------------------------------------------------- quality */

/**
 * "Would a good editor have designed this?" gate — coherence, restraint,
 * hierarchy and a satisfying ending, not combination count.
 */
export function qualityIssues(spec: TemplateSpec): string[] {
  const issues = validateSpec(spec);
  const spine = spec.mediaSlots.filter((s) => s.layout === "full");
  if (spine.length < 2) issues.push("no readable full-screen spine");

  // effect soup: too many simultaneous frames
  const points = spec.mediaSlots.map((s) => s.start + s.duration / 2);
  for (const p of points) {
    const overlapping = spec.mediaSlots.filter((s) => s.start <= p && s.start + s.duration > p);
    if (overlapping.length > 4) issues.push("too many simultaneous frames");
  }
  // hierarchy: text should not stack
  for (let i = 0; i < spec.textSlots.length; i++) {
    for (let j = i + 1; j < spec.textSlots.length; j++) {
      const a = spec.textSlots[i]!;
      const b = spec.textSlots[j]!;
      const overlap = Math.min(a.start + a.duration, b.start + b.duration) - Math.max(a.start, b.start);
      if (overlap > 0.15 && a.position === b.position) issues.push("text collision");
    }
  }
  // satisfying ending: the last shot must be able to land
  const last = [...spine].sort((a, b) => a.start - b.start).pop();
  if (last && last.duration < Math.min(0.8, spec.duration * 0.12)) issues.push("ending too short");
  // restraint: not every cut may be an effect
  const cuts = spec.mediaSlots.filter((s) => s.layout === "full");
  const effects = cuts.filter((s) => s.transitionOut && s.transitionOut !== "hard_cut").length;
  if (cuts.length > 3 && effects / cuts.length > 0.7) issues.push("effect soup");
  return issues;
}

export function composeConcept(
  concept: Concept,
  opts: GenerateOptions,
  seed: number,
  directionOverride?: CreativeDirection,
  nameOverride?: string,
): TemplateSpec {
  let best: TemplateSpec | null = null;
  let bestScore = Infinity;
  const finish = (spec: TemplateSpec) =>
    planCreativeMoments(spec, {
      seed,
      ...(opts.risk !== undefined ? { risk: opts.risk } : {}),
      tags: [...(spec.tags ?? []), ...(opts.aesthetic ? [String(opts.aesthetic)] : [])],
    });
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const direction = directionOverride ?? buildDirection(concept, opts, rng);
    const spec = buildSpec(direction, concept, opts, seed + attempt * 104729, nameOverride);
    const issues = qualityIssues(spec);
    if (issues.length === 0) return finish(spec);
    if (issues.length < bestScore) {
      bestScore = issues.length;
      best = spec;
    }
  }
  return finish(best!);
}

export { CONCEPTS, conceptByKey, fontByKey };
export type { Concept };
