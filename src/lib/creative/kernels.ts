/**
 * CAPABILITY / KERNEL LAYER
 *
 * A kernel is a real, executable piece of motion-design behaviour rendered by
 * `CreativeEventLayer`. Techniques are (kernel + parameters) — that keeps
 * user-invented techniques sandboxed data rather than executable code, so a bad
 * experiment can never break the renderer.
 */

export type ParamType = "number" | "choice" | "color";

export interface ParamDef {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
  choices?: string[];
}

export type KernelFamily =
  | "analog"
  | "editorial"
  | "hand_drawn"
  | "typography"
  | "motion_design"
  | "product"
  | "social";

export interface KernelDef {
  id: string;
  name: string;
  family: KernelFamily;
  /** how it behaves in a timeline */
  role: "transition" | "event" | "treatment";
  /** does it read the footage underneath (echo/tiles/magnifier) */
  usesFootage: boolean;
  tags: string[];
  defaultDuration: number;
  params: ParamDef[];
  /** short human description used by the Lab + DNA panels */
  blurb: string;
  /** true when the kernel is deliberately non-geometric */
  organic: boolean;
}

const n = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
  step = 0.01,
): ParamDef => ({ key, label, type: "number", default: def, min, max, step });

const c = (key: string, label: string, choices: string[], def?: string): ParamDef => ({
  key,
  label,
  type: "choice",
  choices,
  default: def ?? choices[0]!,
});

const DIRS = ["left", "right", "up", "down"];

export const KERNELS: KernelDef[] = [
  {
    id: "paper_rip",
    name: "Paper rip",
    family: "analog",
    role: "transition",
    usesFootage: true,
    organic: true,
    tags: ["editorial", "fashion", "analog", "paper", "mask"],
    defaultDuration: 0.7,
    blurb: "An irregular torn-paper mask rips across the frame, fibrous edge casting a moving shadow.",
    params: [
      c("direction", "Direction", DIRS, "right"),
      n("tearAmount", "Tear roughness", 0.55, 0, 1),
      n("fiber", "Fibre detail", 0.5, 0, 1),
      n("shadowDepth", "Shadow depth", 0.5, 0, 1),
      n("rotation", "Rotation", -4, -20, 20, 0.5),
      { key: "paper", label: "Paper tone", type: "color", default: "#efe9dd" },
    ],
  },
  {
    id: "film_burn",
    name: "Film burn",
    family: "analog",
    role: "transition",
    usesFootage: false,
    organic: true,
    tags: ["analog", "film", "warm", "reveal"],
    defaultDuration: 0.8,
    blurb: "An organic emulsion burn eats outward from a hotspot with amber halation.",
    params: [
      n("x", "Origin X", 0.4, 0, 1),
      n("y", "Origin Y", 0.55, 0, 1),
      n("intensity", "Intensity", 0.7, 0, 1),
      n("spread", "Spread", 0.8, 0.2, 1.6),
    ],
  },
  {
    id: "marker_circle",
    name: "Marker circle",
    family: "hand_drawn",
    role: "event",
    usesFootage: false,
    organic: true,
    tags: ["hand-drawn", "annotation", "product", "marker"],
    defaultDuration: 0.9,
    blurb: "A wobbly marker ellipse draws itself around a detail, then flicks a tick.",
    params: [
      n("x", "X", 0.5, 0, 1),
      n("y", "Y", 0.5, 0, 1),
      n("size", "Size", 0.4, 0.1, 0.9),
      n("wobble", "Wobble", 0.5, 0, 1),
      n("stroke", "Stroke weight", 10, 2, 26, 1),
      n("laps", "Laps", 1.25, 1, 3, 0.25),
    ],
  },
  {
    id: "contact_sheet",
    name: "Contact sheet burst",
    family: "editorial",
    role: "event",
    usesFootage: true,
    organic: false,
    tags: ["editorial", "photography", "burst", "grid"],
    defaultDuration: 1,
    blurb: "The footage multiplies into a scattering contact sheet with frame numbers.",
    params: [
      n("cols", "Columns", 3, 2, 5, 1),
      n("scatter", "Scatter", 0.5, 0, 1),
      n("stagger", "Stagger", 0.5, 0, 1),
      n("numbers", "Frame numbers", 1, 0, 1, 1),
    ],
  },
  {
    id: "freeze_annotation",
    name: "Freeze annotation",
    family: "product",
    role: "event",
    usesFootage: true,
    organic: true,
    tags: ["freeze", "callout", "product", "hand-drawn"],
    defaultDuration: 1.2,
    blurb: "The image holds, drains colour and hand-drawn callout lines label the detail.",
    params: [
      n("x", "Point X", 0.62, 0, 1),
      n("y", "Point Y", 0.45, 0, 1),
      n("desaturate", "Desaturate", 0.7, 0, 1),
      n("lines", "Callouts", 2, 1, 4, 1),
      c("labelStyle", "Label", ["ticket", "underline", "boxed"]),
    ],
  },
  {
    id: "frame_echo",
    name: "Frame echo",
    family: "motion_design",
    role: "treatment",
    usesFootage: true,
    organic: false,
    tags: ["echo", "digital", "trail", "y2k"],
    defaultDuration: 0.6,
    blurb: "Delayed ghost copies of the frame smear behind the live image.",
    params: [
      n("copies", "Copies", 4, 2, 8, 1),
      n("offset", "Offset", 26, 0, 120, 1),
      n("angle", "Angle", 25, 0, 360, 1),
      n("decay", "Decay", 0.55, 0.1, 1),
      c("blend", "Blend", ["screen", "normal", "difference"]),
    ],
  },
  {
    id: "type_crash",
    name: "Type crash",
    family: "typography",
    role: "event",
    usesFootage: false,
    organic: false,
    tags: ["typography", "impact", "hook"],
    defaultDuration: 0.7,
    blurb: "A giant word slams in past its mark, shakes the frame and settles.",
    params: [
      n("size", "Size", 0.24, 0.08, 0.5),
      n("shake", "Shake", 0.5, 0, 1),
      n("overshoot", "Overshoot", 0.6, 0, 1),
      c("treatment", "Treatment", ["solid", "outline", "knockout"]),
      n("rotation", "Rotation", -3, -20, 20, 0.5),
    ],
  },
  {
    id: "word_push",
    name: "Word push",
    family: "typography",
    role: "transition",
    usesFootage: false,
    organic: false,
    tags: ["typography", "transition", "physical"],
    defaultDuration: 0.8,
    blurb: "One oversized word physically shoves the frame out of shot.",
    params: [
      c("direction", "Direction", DIRS, "left"),
      n("size", "Size", 0.3, 0.1, 0.6),
      n("force", "Force", 0.7, 0.2, 1),
    ],
  },
  {
    id: "light_leak",
    name: "Light leak reveal",
    family: "analog",
    role: "transition",
    usesFootage: false,
    organic: true,
    tags: ["analog", "film", "dreamy", "warm"],
    defaultDuration: 0.9,
    blurb: "A soft anamorphic leak sweeps through and blooms the frame open.",
    params: [
      n("angle", "Angle", 105, 0, 180, 1),
      n("warmth", "Warmth", 0.6, 0, 1),
      n("bloom", "Bloom", 0.5, 0, 1),
      n("width", "Width", 0.45, 0.1, 1),
    ],
  },
  {
    id: "film_strip_rush",
    name: "Film strip rush",
    family: "analog",
    role: "event",
    usesFootage: true,
    organic: false,
    tags: ["analog", "film", "sprockets", "rush"],
    defaultDuration: 0.9,
    blurb: "A perforated strip of frames races past like film pulled through a gate.",
    params: [
      n("speed", "Speed", 0.7, 0.2, 1.6),
      n("frames", "Frames", 5, 3, 9, 1),
      c("axis", "Axis", ["vertical", "horizontal"]),
      n("gate", "Gate flicker", 0.4, 0, 1),
    ],
  },
  {
    id: "shutter_sequence",
    name: "Shutter sequence",
    family: "social",
    role: "event",
    usesFootage: false,
    organic: false,
    tags: ["paparazzi", "flash", "camera", "hook"],
    defaultDuration: 0.8,
    blurb: "Rapid shutter blackouts with viewfinder brackets and blown-out flashes.",
    params: [
      n("shots", "Shots", 5, 2, 10, 1),
      n("brightness", "Flash", 0.8, 0.2, 1),
      n("brackets", "Viewfinder", 1, 0, 1, 1),
    ],
  },
  {
    id: "scribble_impact",
    name: "Scribble impact",
    family: "hand_drawn",
    role: "event",
    usesFootage: false,
    organic: true,
    tags: ["hand-drawn", "energy", "burst"],
    defaultDuration: 0.6,
    blurb: "A procedural scribble is drawn in one gesture and bursts radial ink lines.",
    params: [
      n("x", "X", 0.5, 0, 1),
      n("y", "Y", 0.5, 0, 1),
      n("chaos", "Chaos", 0.6, 0, 1),
      n("density", "Density", 0.5, 0.1, 1),
      n("stroke", "Stroke", 8, 2, 22, 1),
    ],
  },
  {
    id: "photo_stack",
    name: "Photo stack",
    family: "editorial",
    role: "event",
    usesFootage: true,
    organic: false,
    tags: ["editorial", "photography", "stack"],
    defaultDuration: 1,
    blurb: "Bordered prints drop into a loose stack, each one a beat apart.",
    params: [
      n("count", "Prints", 4, 2, 7, 1),
      n("spread", "Spread", 0.5, 0, 1),
      n("tilt", "Tilt", 0.5, 0, 1),
      n("border", "Border", 18, 0, 48, 1),
    ],
  },
  {
    id: "magnifier",
    name: "Product magnifier",
    family: "product",
    role: "event",
    usesFootage: true,
    organic: false,
    tags: ["product", "detail", "callout"],
    defaultDuration: 1.2,
    blurb: "A circular loupe travels across the product enlarging the detail beneath it.",
    params: [
      n("zoom", "Zoom", 2.2, 1.2, 4),
      n("size", "Loupe size", 0.34, 0.15, 0.6),
      n("travel", "Travel", 0.4, 0, 1),
      n("ring", "Ring weight", 6, 0, 20, 1),
    ],
  },
  {
    id: "crop_marks",
    name: "Animated crop marks",
    family: "editorial",
    role: "treatment",
    usesFootage: false,
    organic: false,
    tags: ["editorial", "grid", "restrained", "magazine"],
    defaultDuration: 1.4,
    blurb: "Registration marks, a hairline grid and an index number set the page.",
    params: [
      n("inset", "Inset", 0.07, 0.02, 0.2),
      n("grid", "Grid", 0.4, 0, 1),
      n("index", "Index number", 3, 0, 99, 1),
      n("weight", "Weight", 2, 1, 6, 1),
    ],
  },
  {
    id: "texture_wash",
    name: "Texture wash",
    family: "analog",
    role: "treatment",
    usesFootage: false,
    organic: true,
    tags: ["texture", "paper", "grain", "subtle"],
    defaultDuration: 1.5,
    blurb: "A moving paper/grain wash drifts over the frame like a printed surface.",
    params: [
      c("texture", "Texture", ["paper", "grain", "photocopy", "dust"]),
      n("opacity", "Opacity", 0.3, 0, 0.8),
      n("drift", "Drift", 0.4, 0, 1),
      n("contrast", "Contrast", 0.4, 0, 1),
    ],
  },
  {
    id: "photocopy_flash",
    name: "Photocopy flash",
    family: "analog",
    role: "transition",
    usesFootage: false,
    organic: true,
    tags: ["analog", "punk", "high-contrast", "zine"],
    defaultDuration: 0.5,
    blurb: "A scanner bar sweeps and leaves a blown-out photocopied ghost.",
    params: [
      n("bar", "Bar width", 0.18, 0.05, 0.5),
      n("blowout", "Blow-out", 0.7, 0, 1),
      n("dust", "Dust", 0.5, 0, 1),
    ],
  },
  {
    id: "mask_draw_on",
    name: "Mask draw-on",
    family: "motion_design",
    role: "transition",
    usesFootage: true,
    organic: true,
    tags: ["mask", "organic", "reveal"],
    defaultDuration: 0.8,
    blurb: "An irregular blob mask grows in a single gesture to reveal the frame.",
    params: [
      n("x", "Origin X", 0.5, 0, 1),
      n("y", "Origin Y", 0.5, 0, 1),
      n("lobes", "Lobes", 7, 3, 14, 1),
      n("irregular", "Irregularity", 0.5, 0, 1),
    ],
  },
  {
    id: "ghost_trail",
    name: "Ghost trail",
    family: "motion_design",
    role: "treatment",
    usesFootage: true,
    organic: false,
    tags: ["trail", "motion", "digital"],
    defaultDuration: 0.8,
    blurb: "A soft directional smear trails behind the moving image.",
    params: [
      n("length", "Length", 0.5, 0, 1),
      n("angle", "Angle", 90, 0, 360, 1),
      n("tint", "Tint", 0.4, 0, 1),
    ],
  },
  {
    id: "editorial_numbers",
    name: "Editorial number sequence",
    family: "editorial",
    role: "event",
    usesFootage: false,
    organic: false,
    tags: ["editorial", "typography", "counting", "restrained"],
    defaultDuration: 1.2,
    blurb: "Set numbers step up in the corner like a contact index.",
    params: [
      n("from", "From", 1, 0, 98, 1),
      n("to", "To", 6, 1, 99, 1),
      n("size", "Size", 0.12, 0.04, 0.3),
      c("corner", "Corner", ["tl", "tr", "bl", "br"], "bl"),
    ],
  },
  {
    id: "ripped_edge_wipe",
    name: "Ripped edge wipe",
    family: "analog",
    role: "transition",
    usesFootage: false,
    organic: true,
    tags: ["analog", "paper", "wipe", "tactile"],
    defaultDuration: 0.6,
    blurb: "A torn edge of tinted stock wipes through, fibres catching the light.",
    params: [
      c("direction", "Direction", DIRS, "up"),
      n("rough", "Roughness", 0.6, 0, 1),
      { key: "tint", label: "Stock", type: "color", default: "#101010" },
    ],
  },
];

export const KERNEL_BY_ID = Object.fromEntries(KERNELS.map((k) => [k.id, k])) as Record<
  string,
  KernelDef
>;

export type Params = Record<string, number | string>;

export function defaultParams(kernelId: string): Params {
  const k = KERNEL_BY_ID[kernelId];
  if (!k) return {};
  return Object.fromEntries(k.params.map((p) => [p.key, p.default]));
}

export function randomizeParams(kernelId: string, rnd: () => number): Params {
  const k = KERNEL_BY_ID[kernelId];
  if (!k) return {};
  return Object.fromEntries(
    k.params.map((p) => {
      if (p.type === "choice") return [p.key, p.choices![Math.floor(rnd() * p.choices!.length)]!];
      if (p.type === "color") return [p.key, p.default];
      const min = p.min ?? 0;
      const max = p.max ?? 1;
      const raw = min + rnd() * (max - min);
      const step = p.step ?? 0.01;
      return [p.key, Math.round(raw / step) * step];
    }),
  );
}

export function num(params: Params, key: string, fallback = 0): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

export function str(params: Params, key: string, fallback = ""): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}
