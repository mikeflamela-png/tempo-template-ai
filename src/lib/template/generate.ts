import type {
  Animation,
  Layout,
  MediaSlot,
  Palette,
  Purpose,
  TemplateSpec,
  TextSlot,
  TextStyleName,
  Transition,
} from "./types";
import { validateSpec } from "./types";

export interface GenerateOptions {
  prompt: string;
  platform: string;
  duration: number;
  format: string;
  energy: string;
  complexity: string;
}

export const PLATFORMS = ["Instagram / Reels", "TikTok", "Meta Ads", "YouTube Shorts"];
export const DURATIONS = [6, 8, 10, 12, 15, 20, 30];
export const FORMATS = ["9:16", "1:1", "4:5", "16:9"];
export const ENERGIES = ["Minimal", "Cinematic", "Energetic", "Aggressive", "Playful"];
export const COMPLEXITIES = ["Simple", "Creative", "Experimental"];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

const PALETTES: Palette[] = [
  { bg: "#0b0b0c", ink: "#f7f4ef", accent: "#ff5722" },
  { bg: "#efe9df", ink: "#17150f", accent: "#c2410c" },
  { bg: "#08090c", ink: "#ffffff", accent: "#7dd3fc" },
  { bg: "#f5f3ee", ink: "#111111", accent: "#111111" },
  { bg: "#0d0f08", ink: "#f2ffd6", accent: "#d7ff36" },
  { bg: "#0f0a12", ink: "#ffeede", accent: "#ff2d6f" },
];

interface Family {
  key: string;
  label: string;
  shotRange: [number, number];
  burst: boolean;
  transitions: Transition[];
  animsIn: Animation[];
  during: Animation[];
  multiFrame: Layout[];
  textStyles: TextStyleName[];
  structure: Purpose[];
  pacing: string;
  typography: string;
  paletteIdx: number[];
  overlayGrain: boolean;
  words: string[];
}

const FAMILIES: Family[] = [
  {
    key: "rapid",
    label: "Rapid Product",
    shotRange: [0.28, 0.9],
    burst: true,
    transitions: ["hard_cut", "flash", "whip", "scale_out"],
    animsIn: ["punch_in", "snap_zoom", "slide_left", "slide_up", "pull_out"],
    during: ["drift", "push_in", "none"],
    multiFrame: ["pip", "band"],
    textStyles: ["oversized_hook", "feature_callout", "kinetic_words", "cta_lockup"],
    structure: ["hook", "product", "detail", "proof", "hero"],
    pacing: "rapid burst → release → hero",
    typography: "oversized hook + callouts",
    paletteIdx: [0, 5, 4],
    overlayGrain: true,
    words: ["FLASH", "RAPID", "PUNCH", "SNAP", "BURST"],
  },
  {
    key: "editorial",
    label: "Editorial",
    shotRange: [1.1, 2.6],
    burst: false,
    transitions: ["wipe_left", "wipe_up", "blur", "hard_cut"],
    animsIn: ["mask_reveal", "slide_left", "slide_right", "expand", "push_in"],
    during: ["drift", "pan_right", "none"],
    multiFrame: ["split-left", "split-right", "grid-tl", "grid-br", "tall-inset"],
    textStyles: ["centered_statement", "minimal_caption", "masked_reveal", "cta_lockup"],
    structure: ["hook", "lifestyle", "detail", "product", "hero"],
    pacing: "slow-fast-slow with whitespace",
    typography: "restrained, edge aligned",
    paletteIdx: [3, 1, 2],
    overlayGrain: false,
    words: ["SPLIT", "PAPER", "MARGIN", "EDIT", "FOLIO"],
  },
  {
    key: "cinematic",
    label: "Cinematic",
    shotRange: [1.6, 3.4],
    burst: true,
    transitions: ["blur", "scale_out", "hard_cut", "mask_out"],
    animsIn: ["push_in", "pull_out", "mask_reveal", "blur_in"],
    during: ["drift", "pan_left", "push_in"],
    multiFrame: ["floating", "tall-inset"],
    textStyles: ["centered_statement", "minimal_caption", "stagger_reveal", "cta_lockup"],
    structure: ["lifestyle", "detail", "proof", "hero"],
    pacing: "long shots, build and release",
    typography: "quiet captions",
    paletteIdx: [1, 2, 0],
    overlayGrain: true,
    words: ["SLOW", "GRAIN", "DUSK", "WIDE", "HOLD"],
  },
  {
    key: "kinetic",
    label: "Kinetic",
    shotRange: [0.4, 1.2],
    burst: true,
    transitions: ["whip", "wipe_up", "flash", "hard_cut", "wipe_left"],
    animsIn: ["expand", "slide_up", "snap_zoom", "scale_bounce", "slide_right"],
    during: ["pan_right", "drift", "pan_left"],
    multiFrame: ["pip", "floating", "grid-tr", "band"],
    textStyles: ["kinetic_words", "stagger_reveal", "edge_aligned", "cta_lockup"],
    structure: ["hook", "detail", "product", "proof", "hero"],
    pacing: "rhythmic cuts on the beat",
    typography: "kinetic type everywhere",
    paletteIdx: [4, 5, 0],
    overlayGrain: true,
    words: ["KINETIC", "RHYTHM", "PULSE", "STACK", "MOTION"],
  },
  {
    key: "performance",
    label: "Performance Ad",
    shotRange: [0.7, 1.8],
    burst: false,
    transitions: ["hard_cut", "flash", "scale_out", "wipe_up"],
    animsIn: ["punch_in", "slide_left", "push_in", "snap_zoom"],
    during: ["push_in", "drift", "none"],
    multiFrame: ["split-top", "split-bottom", "pip"],
    textStyles: ["oversized_hook", "feature_callout", "stagger_reveal", "cta_lockup"],
    structure: ["hook", "product", "proof", "hero"],
    pacing: "hook → benefit → proof → CTA",
    typography: "claims and proof callouts",
    paletteIdx: [0, 2, 5],
    overlayGrain: false,
    words: ["PROOF", "CLAIM", "DIRECT", "OFFER", "CONVERT"],
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    shotRange: [1.2, 2.8],
    burst: true,
    transitions: ["blur", "hard_cut", "wipe_left", "scale_out"],
    animsIn: ["push_in", "pan_left", "mask_reveal", "pull_out"],
    during: ["drift", "pan_right", "push_in"],
    multiFrame: ["floating", "split-bottom"],
    textStyles: ["minimal_caption", "stagger_reveal", "centered_statement", "cta_lockup"],
    structure: ["lifestyle", "detail", "product", "hero"],
    pacing: "human first, product integrated",
    typography: "lowercase captions",
    paletteIdx: [1, 3, 2],
    overlayGrain: true,
    words: ["GOLDEN", "EVERYDAY", "OUTSIDE", "WARM", "DRIFT"],
  },
];

const NOUNS = ["STACK", "CUT", "REVEAL", "LOOP", "FRAME", "PULSE", "SHIFT", "GRID", "BURN", "LINE"];
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
const PROOFS = [
  "10,000 5-STAR REVIEWS",
  "40% MORE REBOUND",
  "WORN BY 1M PEOPLE",
  "TESTED 500 MILES",
];
const CTAS = ["SHOP NOW", "TAP TO SHOP", "AVAILABLE NOW", "GET YOURS", "EXPLORE THE RANGE"];

const FORMAT_SIZE: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "16:9": [1920, 1080],
};

const ENERGY_SPEED: Record<string, number> = {
  Minimal: 1.45,
  Cinematic: 1.3,
  Energetic: 0.85,
  Aggressive: 0.62,
  Playful: 0.95,
};

function composeSpec(
  family: Family,
  opts: GenerateOptions,
  seed: number,
  nameOverride?: string,
): TemplateSpec {
  const rng = mulberry32(seed);
  const [width, height] = FORMAT_SIZE[opts.format] ?? FORMAT_SIZE["9:16"]!;
  const speed = ENERGY_SPEED[opts.energy] ?? 1;
  const complexityBoost =
    opts.complexity === "Experimental" ? 1.6 : opts.complexity === "Creative" ? 1.15 : 0.75;
  const total = opts.duration;

  const slots: MediaSlot[] = [];
  let cursor = 0;
  let i = 1;
  const beats: number[] = [0];
  const struct = family.structure;

  while (cursor < total - 0.05) {
    const remaining = total - cursor;
    const isFinal = remaining <= Math.max(1.6, total * 0.18);
    let dur: number;
    if (isFinal) {
      dur = remaining;
    } else {
      const [lo, hi] = family.shotRange;
      const burstMode = family.burst && rng() < 0.34;
      dur = burstMode
        ? lo * speed * 0.7
        : (lo + rng() * (hi - lo)) * speed;
      dur = Math.min(Math.max(dur, 0.24), remaining - 0.8);
      if (!Number.isFinite(dur) || dur <= 0.24) dur = Math.min(0.4, remaining);
    }
    const purpose = isFinal ? "hero" : struct[(i - 1) % struct.length]!;
    slots.push({
      id: `slot_${String(i).padStart(2, "0")}`,
      label: isFinal ? "HERO" : purpose.toUpperCase(),
      start: Number(cursor.toFixed(2)),
      duration: Number(dur.toFixed(2)),
      purpose,
      layout: "full",
      animationIn: pick(rng, family.animsIn),
      animationDuring: dur > 1 ? pick(rng, family.during) : "none",
      transitionOut: isFinal ? "hard_cut" : pick(rng, family.transitions),
    });
    cursor = Number((cursor + dur).toFixed(2));
    beats.push(cursor);
    i++;
    if (i > 40) break;
  }

  // multi-frame moments (intentional overlapping layouts)
  const extras = Math.round(complexityBoost * (1 + rng() * 2));
  for (let k = 0; k < extras; k++) {
    const host = slots[Math.floor(rng() * Math.max(slots.length - 1, 1))]!;
    if (host.duration < 0.5) continue;
    slots.push({
      id: `slot_x${k + 1}`,
      label: "INSET",
      start: host.start,
      duration: host.duration,
      purpose: pick(rng, ["detail", "product", "lifestyle"] as Purpose[]),
      layout: pick(rng, family.multiFrame),
      animationIn: pick(rng, family.animsIn),
      transitionOut: pick(rng, family.transitions),
      transform: { rotation: rng() < 0.4 ? (rng() * 8 - 4) : 0 },
    });
  }

  const textPlan: Array<{ label: string; value: string; style: TextStyleName }> = [
    { label: "HOOK", value: pick(rng, HOOKS), style: family.textStyles[0]! },
    { label: "BENEFIT", value: pick(rng, BENEFITS), style: family.textStyles[1]! },
    { label: "PROOF", value: pick(rng, PROOFS), style: family.textStyles[2]! },
    { label: "CTA", value: pick(rng, CTAS), style: "cta_lockup" },
  ];
  const textCount = opts.complexity === "Simple" ? 2 : total < 9 ? 3 : 4;
  const textSlots: TextSlot[] = textPlan.slice(0, textCount).map((tp, idx, arr) => {
    const isCta = tp.label === "CTA" || idx === arr.length - 1;
    const start = isCta
      ? Math.max(0, total - Math.min(2.6, total * 0.28))
      : Number(((total * (idx + 0.15)) / (arr.length + 0.6)).toFixed(2));
    const dur = isCta
      ? total - start
      : Math.min(Math.max(1.1, total * 0.16), total - start - 0.2);
    return {
      id: `text_${String(idx + 1).padStart(2, "0")}`,
      label: tp.label,
      value: isCta ? pick(rng, CTAS) : tp.value,
      start,
      duration: Number(Math.max(0.6, dur).toFixed(2)),
      style: isCta ? "cta_lockup" : tp.style,
      position: idx === 0 ? "center" : isCta ? "bottom" : pick(rng, ["top", "bottom", "center"]),
      align: pick(rng, ["center", "left"]),
      accent: idx === 0 || isCta,
    };
  });

  const overlays: TemplateSpec["overlays"] = [];
  if (family.overlayGrain) overlays.push({ type: "grain", start: 0, duration: total });
  overlays.push({ type: "progress", start: 0, duration: total, accent: true });
  if (family.key === "cinematic" || family.key === "lifestyle")
    overlays.push({ type: "vignette", start: 0, duration: total });
  if (family.key === "editorial") overlays.push({ type: "frame_line", start: 0, duration: total });
  slots
    .filter((s) => s.transitionOut === "flash")
    .slice(0, 4)
    .forEach((s) =>
      overlays.push({
        type: "flash",
        start: Number((s.start + s.duration - 0.06).toFixed(2)),
        duration: 0.12,
        accent: rng() < 0.5,
      }),
    );

  const name =
    nameOverride ??
    `${pick(rng, family.words)} ${pick(rng, NOUNS)}`;

  return {
    id: `gen-${seed.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`,
    name,
    duration: total,
    fps: 30,
    width,
    height,
    tags: [family.label, opts.platform],
    palette: PALETTES[family.paletteIdx[Math.floor(rng() * family.paletteIdx.length)]!]!,
    mediaSlots: slots.sort((a, b) => a.start - b.start),
    textSlots,
    overlays,
    beatMarkers: beats,
    creativeProfile: {
      family: family.label,
      energy: opts.energy,
      pacing: family.pacing,
      typography: family.typography,
      transitionStyle: family.transitions.join(" / "),
      structure: family.structure.join(" → "),
    },
  };
}

function composeValid(family: Family, opts: GenerateOptions, seed: number, name?: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const spec = composeSpec(family, opts, seed + attempt * 7919, name);
    if (validateSpec(spec).length === 0) return spec;
  }
  return composeSpec(family, opts, seed, name);
}

function familiesForPrompt(prompt: string, energy: string, rng: Rng): Family[] {
  const p = prompt.toLowerCase();
  const score = (f: Family) => {
    let s = rng();
    if (energy === "Minimal" && (f.key === "editorial" || f.key === "cinematic")) s += 1.2;
    if (energy === "Cinematic" && (f.key === "cinematic" || f.key === "lifestyle")) s += 1.2;
    if (energy === "Aggressive" && (f.key === "rapid" || f.key === "kinetic")) s += 1.2;
    if (energy === "Energetic" && (f.key === "kinetic" || f.key === "rapid")) s += 1;
    if (energy === "Playful" && f.key === "kinetic") s += 0.8;
    if (/ad|convert|sale|offer|performance/.test(p) && f.key === "performance") s += 1;
    if (/lifestyle|people|human|outdoor|travel/.test(p) && f.key === "lifestyle") s += 1;
    if (/type|text|caption|kinetic/.test(p) && f.key === "kinetic") s += 0.9;
    if (/editorial|minimal|premium|luxury|fashion/.test(p) && f.key === "editorial") s += 0.9;
    if (/fast|punchy|energetic|hype/.test(p) && f.key === "rapid") s += 0.9;
    return s;
  };
  return [...FAMILIES].sort((a, b) => score(b) - score(a));
}

export function generateTemplates(opts: GenerateOptions, count = 4): TemplateSpec[] {
  const seed = Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const ranked = familiesForPrompt(opts.prompt, opts.energy, rng);
  return ranked
    .slice(0, count)
    .map((family, i) => composeValid(family, opts, seed + i * 104729));
}

export function regenerateSimilar(
  spec: TemplateSpec,
  opts: GenerateOptions,
  count = 5,
): TemplateSpec[] {
  const family =
    FAMILIES.find((f) => f.label === spec.creativeProfile.family) ?? FAMILIES[0]!;
  const seed = Math.floor(Math.random() * 1e9);
  return Array.from({ length: count }, (_, i) =>
    composeValid(
      family,
      { ...opts, duration: spec.duration },
      seed + i * 7907,
      `${spec.name.split(" ")[0]} ${NOUNS[(seed + i) % NOUNS.length]}`,
    ),
  );
}