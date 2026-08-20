export type Purpose =
  | "hook"
  | "product"
  | "detail"
  | "lifestyle"
  | "proof"
  | "hero";

export const LAYOUTS = [
  "full",
  "split-left",
  "split-right",
  "split-top",
  "split-bottom",
  "grid-tl",
  "grid-tr",
  "grid-bl",
  "grid-br",
  "pip",
  "floating",
  "band",
  "tall-inset",
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const ANIMATIONS = [
  "none",
  "punch_in",
  "push_in",
  "pull_out",
  "slide_left",
  "slide_right",
  "slide_up",
  "slide_down",
  "snap_zoom",
  "scale_bounce",
  "drift",
  "pan_left",
  "pan_right",
  "freeze",
  "blur_in",
  "mask_reveal",
  "expand",
] as const;
export type Animation = (typeof ANIMATIONS)[number];

export const TRANSITIONS = [
  "hard_cut",
  "flash",
  "whip",
  "blur",
  "wipe_left",
  "wipe_up",
  "scale_out",
  "mask_out",
] as const;
export type Transition = (typeof TRANSITIONS)[number];

export interface MediaSlot {
  id: string;
  label: string;
  start: number;
  duration: number;
  purpose: Purpose;
  layout: Layout;
  animationIn?: Animation;
  animationDuring?: Animation;
  animationOut?: Animation;
  transitionOut?: Transition;
  transform?: {
    startScale?: number;
    endScale?: number;
    x?: number;
    y?: number;
    rotation?: number;
  };
}

export type TextStyleName =
  | "oversized_hook"
  | "kinetic_words"
  | "stagger_reveal"
  | "feature_callout"
  | "minimal_caption"
  | "centered_statement"
  | "edge_aligned"
  | "masked_reveal"
  | "cta_lockup";

export interface TextSlot {
  id: string;
  label: string;
  value: string;
  start: number;
  duration: number;
  style: TextStyleName;
  position: "top" | "center" | "bottom";
  align?: "left" | "center" | "right";
  accent?: boolean;
}

export interface Overlay {
  type: "flash" | "bar_wipe" | "grain" | "vignette" | "progress" | "frame_line";
  start: number;
  duration: number;
  accent?: boolean;
}

export interface CreativeProfile {
  family: string;
  energy: string;
  pacing: string;
  typography: string;
  transitionStyle: string;
  structure: string;
}

export interface Palette {
  bg: string;
  ink: string;
  accent: string;
}

export interface TemplateSpec {
  id: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  tags: string[];
  palette: Palette;
  mediaSlots: MediaSlot[];
  textSlots: TextSlot[];
  overlays: Overlay[];
  beatMarkers: number[];
  creativeProfile: CreativeProfile;
}

export interface MediaAssignment {
  url: string;
  kind: "image" | "video";
  name: string;
  inPoint?: number;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  muted?: boolean;
}

export type MediaMap = Record<string, MediaAssignment>;

export function validateSpec(spec: TemplateSpec): string[] {
  const errors: string[] = [];
  if (spec.duration <= 0) errors.push("duration must be positive");
  if (spec.mediaSlots.length === 0) errors.push("template needs media slots");
  for (const s of spec.mediaSlots) {
    if (s.duration <= 0.05) errors.push(`${s.id}: duration too short`);
    if (s.start < 0) errors.push(`${s.id}: negative start`);
    if (s.start + s.duration > spec.duration + 0.001)
      errors.push(`${s.id}: exceeds total duration`);
    if (s.animationIn && !ANIMATIONS.includes(s.animationIn))
      errors.push(`${s.id}: unsupported animation`);
    if (s.transitionOut && !TRANSITIONS.includes(s.transitionOut))
      errors.push(`${s.id}: unsupported transition`);
    if (!LAYOUTS.includes(s.layout)) errors.push(`${s.id}: unsupported layout`);
  }
  // gap detection across the full-screen spine
  const spine = spec.mediaSlots
    .filter((s) => s.layout === "full")
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < spine.length; i++) {
    const gap = spine[i].start - (spine[i - 1].start + spine[i - 1].duration);
    if (gap > 0.35) errors.push(`gap before ${spine[i].id}`);
  }
  for (const t of spec.textSlots) {
    if (t.start + t.duration > spec.duration + 0.001)
      errors.push(`${t.id}: text exceeds duration`);
  }
  return errors;
}