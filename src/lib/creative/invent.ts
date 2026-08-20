/**
 * INVENTION WORKBENCH ENGINE
 *
 * Turns a natural-language creative brief into playable technique experiments.
 * Modes:
 *  - invent    : new technique from the brief
 *  - mutate    : push an existing technique somewhere unexpected
 *  - combine   : layer two techniques into one composite moment
 *  - reference : analyse a described / linked reference and extract principles
 */
import {
  KERNELS,
  KERNEL_BY_ID,
  defaultParams,
  randomizeParams,
  type KernelDef,
  type Params,
} from "./kernels";
import { allTechniques, tasteScore, type Technique } from "./registry";

export type LabMode = "invent" | "mutate" | "combine" | "reference";

export interface ExperimentLayer {
  kernel: string;
  params: Params;
  offset: number;
  duration: number;
}

export interface Experiment {
  id: string;
  title: string;
  rationale: string;
  principles: string[];
  tags: string[];
  duration: number;
  layers: ExperimentLayer[];
  word?: string;
  kind: "novel" | "mutation" | "composite" | "extraction";
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYWORD_TAGS: Record<string, string[]> = {
  paper: ["paper", "analog", "editorial"],
  tear: ["paper", "mask"],
  rip: ["paper", "mask"],
  film: ["film", "analog"],
  grain: ["grain", "analog"],
  analog: ["analog", "film"],
  vhs: ["analog", "y2k", "digital"],
  editorial: ["editorial", "magazine", "restrained"],
  magazine: ["editorial", "magazine"],
  fashion: ["fashion", "editorial"],
  luxury: ["restrained", "editorial"],
  hand: ["hand-drawn", "marker"],
  draw: ["hand-drawn", "annotation"],
  sketch: ["hand-drawn"],
  annotate: ["annotation", "callout"],
  product: ["product", "detail"],
  detail: ["detail", "product"],
  type: ["typography", "impact"],
  text: ["typography"],
  word: ["typography"],
  fast: ["burst", "impact"],
  punch: ["impact", "burst"],
  energy: ["energy", "burst"],
  chaos: ["energy", "burst"],
  calm: ["restrained", "subtle"],
  slow: ["restrained", "subtle", "dreamy"],
  dream: ["dreamy", "warm"],
  warm: ["warm", "film"],
  photo: ["photography", "editorial"],
  camera: ["camera", "photography"],
  flash: ["flash", "camera"],
  zine: ["zine", "punk", "high-contrast"],
  punk: ["punk", "high-contrast"],
  street: ["energy", "digital"],
  glitch: ["digital", "y2k"],
  trail: ["trail", "motion"],
  organic: ["organic", "mask", "paper"],
};

function tagsFromPrompt(prompt: string) {
  const words = prompt.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const tags = new Set<string>();
  words.forEach((w) => KEYWORD_TAGS[w]?.forEach((t) => tags.add(t)));
  return [...tags];
}

function scoreKernel(k: KernelDef, wanted: string[], rnd: () => number) {
  const overlap = k.tags.filter((t) => wanted.includes(t)).length;
  return overlap * 3 + tasteScore(k.tags) * 0.25 + (k.organic ? 0.9 : 0) + rnd() * 1.4;
}

function pickKernels(wanted: string[], rnd: () => number, count: number) {
  return [...KERNELS]
    .map((k) => ({ k, s: scoreKernel(k, wanted, rnd) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(count, 4))
    .sort(() => rnd() - 0.5)
    .slice(0, count)
    .map((x) => x.k);
}

function blendParams(base: Params, rnd: () => number, kernelId: string, amount: number): Params {
  const rand = randomizeParams(kernelId, rnd);
  const out: Params = { ...base };
  Object.keys(rand).forEach((key) => {
    if (rnd() < amount) out[key] = rand[key]!;
  });
  return out;
}

const PRINCIPLE_POOL = [
  "one gesture, one idea",
  "let the edge be irregular, never a straight rectangle",
  "a beat of stillness before the impact reads louder",
  "the treatment should feel physical, like it was made by hand",
  "the surprise arrives before the eye expects it",
  "carry the accent colour through the whole moment",
  "scale contrast does the work; movement only supports it",
  "leave one frame of overshoot so it feels alive",
];

function principles(rnd: () => number, extra: string[]) {
  const pool = [...PRINCIPLE_POOL].sort(() => rnd() - 0.5).slice(0, 2);
  return [...extra, ...pool].slice(0, 3);
}

function titleFor(prompt: string, k: KernelDef, rnd: () => number) {
  const lead = prompt.trim().split(/\s+/).slice(0, 2).join(" ");
  const suffix = ["study", "variant", "cut", "move", "pass"][Math.floor(rnd() * 5)]!;
  return `${(lead || k.name).replace(/^\w/, (c) => c.toUpperCase())} ${suffix}`;
}

export function generateExperiments(input: {
  prompt: string;
  mode: LabMode;
  source?: Technique | null;
  second?: Technique | null;
  count?: number;
  wildness?: number;
}): Experiment[] {
  const { prompt, mode, source, second, count = 4 } = input;
  const wildness = input.wildness ?? 0.6;
  const seed = hash(`${prompt}|${mode}|${source?.id ?? ""}|${Date.now() >> 12}`);
  const rnd = rngFrom(seed);
  const wanted = tagsFromPrompt(prompt);
  const library = allTechniques();

  return Array.from({ length: count }, (_, i): Experiment => {
    const r = rngFrom(seed + i * 9176);
    if (mode === "mutate" && source) {
      const k = KERNEL_BY_ID[source.kernel]!;
      const params = blendParams(source.params, r, source.kernel, 0.35 + wildness * 0.5);
      const stack = r() < wildness * 0.6;
      const partner = stack ? pickKernels(wanted.concat(k.tags), r, 1)[0] : null;
      return {
        id: `exp-${seed}-${i}`,
        title: `${source.name} · mutation ${String.fromCharCode(65 + i)}`,
        rationale: `Pushes ${source.name.toLowerCase()} ${wildness > 0.7 ? "far" : "a step"} past its default: ${Object.keys(params).slice(0, 3).join(", ")} re-tuned${partner ? `, layered with ${partner.name.toLowerCase()}` : ""}.`,
        principles: principles(r, ["keep the parent's silhouette, change its behaviour"]),
        tags: [...new Set([...source.tags, ...(partner?.tags ?? [])])],
        duration: Math.max(0.4, source.duration * (0.7 + r() * 0.8)),
        kind: "mutation",
        layers: [
          { kernel: source.kernel, params, offset: 0, duration: source.duration },
          ...(partner
            ? [
                {
                  kernel: partner.id,
                  params: blendParams(defaultParams(partner.id), r, partner.id, wildness * 0.5),
                  offset: 0.15,
                  duration: partner.defaultDuration,
                },
              ]
            : []),
        ],
        word: prompt.split(/\s+/)[0]?.toUpperCase() ?? "NOW",
      };
    }

    if (mode === "combine") {
      const a = source ?? library[Math.floor(r() * library.length)]!;
      const b =
        second ??
        library.filter((t) => t.kernel !== a.kernel)[
          Math.floor(r() * Math.max(1, library.length - 1))
        ]!;
      const offset = r() < 0.5 ? 0 : 0.12 + r() * 0.3;
      return {
        id: `exp-${seed}-${i}`,
        title: `${a.name.split(" ")[0]} × ${b.name.split(" ")[0]} ${String.fromCharCode(65 + i)}`,
        rationale: `${a.name} and ${b.name} run ${offset < 0.05 ? "simultaneously" : "overlapped"}, so the analog texture and the graphic move read as one gesture.`,
        principles: principles(r, ["two techniques, one silhouette"]),
        tags: [...new Set([...a.tags, ...b.tags])],
        duration: Math.max(a.duration, offset + b.duration),
        kind: "composite",
        layers: [
          { kernel: a.kernel, params: blendParams(a.params, r, a.kernel, wildness * 0.3), offset: 0, duration: a.duration },
          { kernel: b.kernel, params: blendParams(b.params, r, b.kernel, wildness * 0.3), offset, duration: b.duration },
        ],
        word: prompt.split(/\s+/)[0]?.toUpperCase() ?? "NOW",
      };
    }

    if (mode === "reference") {
      const ks = pickKernels(wanted, r, 2);
      const k = ks[0]!;
      const k2 = ks[1]!;
      return {
        id: `exp-${seed}-${i}`,
        title: `Extracted principle ${String.fromCharCode(65 + i)}`,
        rationale: `Read from the reference: ${wanted.slice(0, 3).join(", ") || "physical texture, abrupt timing"}. Rebuilt with ${k.name.toLowerCase()} carrying the moment and ${k2.name.toLowerCase()} handling the hand-off — the principle, not a copy.`,
        principles: principles(r, ["reproduce the principle, never the shot"]),
        tags: [...new Set([...k.tags, ...k2.tags, ...wanted])],
        duration: k.defaultDuration + 0.3,
        kind: "extraction",
        layers: [
          { kernel: k.id, params: blendParams(defaultParams(k.id), r, k.id, 0.25), offset: 0, duration: k.defaultDuration },
          { kernel: k2.id, params: blendParams(defaultParams(k2.id), r, k2.id, 0.3), offset: 0.25, duration: k2.defaultDuration },
        ],
        word: prompt.split(/\s+/)[0]?.toUpperCase() ?? "NOW",
      };
    }

    // invent
    const ks = pickKernels(wanted, r, r() < 0.45 + wildness * 0.3 ? 2 : 1);
    const k = ks[0]!;
    const layers: ExperimentLayer[] = ks.map((kk, idx) => ({
      kernel: kk.id,
      params: blendParams(defaultParams(kk.id), r, kk.id, 0.3 + wildness * 0.5),
      offset: idx === 0 ? 0 : 0.1 + r() * 0.35,
      duration: kk.defaultDuration * (0.8 + r() * 0.6),
    }));
    return {
      id: `exp-${seed}-${i}`,
      title: titleFor(prompt, k, r),
      rationale: `${k.blurb} Tuned toward "${prompt.trim() || "an unexpected moment"}"${ks[1] ? `, with ${ks[1].name.toLowerCase()} carrying the exit` : ""}.`,
      principles: principles(r, wanted.length ? [`brief reads as: ${wanted.slice(0, 3).join(" / ")}`] : []),
      tags: [...new Set([...k.tags, ...wanted])],
      duration: Math.max(...layers.map((l) => l.offset + l.duration)),
      kind: "novel",
      layers,
      word: prompt.split(/\s+/).slice(-1)[0]?.toUpperCase() ?? "NOW",
    };
  });
}

/** Alternatives for one highlighted region of a timeline ("edit this moment"). */
export function momentAlternatives(input: {
  prompt: string;
  duration: number;
  count?: number;
  avoidGeometric?: boolean;
}): Experiment[] {
  const exps = generateExperiments({
    prompt: input.prompt,
    mode: "invent",
    count: input.count ?? 4,
    wildness: 0.7,
  });
  return exps.map((e) => {
    const scale = input.duration / Math.max(0.2, e.duration);
    return {
      ...e,
      duration: input.duration,
      layers: e.layers.map((l) => ({
        ...l,
        offset: l.offset * scale,
        duration: Math.min(input.duration, l.duration * scale),
      })),
    };
  });
}
