export type Purpose =
  | "hook"
  | "product"
  | "detail"
  | "lifestyle"
  | "proof"
  | "hero";

export const LAYOUTS = [
  // full screen
  "full",
  // vertical / horizontal splits
  "split-left",
  "split-right",
  "split-top",
  "split-bottom",
  // diagonal split
  "diag-left",
  "diag-right",
  // 3-up columns
  "col-1",
  "col-2",
  "col-3",
  // 2x2 grid / 4-up
  "grid-tl",
  "grid-tr",
  "grid-bl",
  "grid-br",
  // stacked frames (3 horizontal bands)
  "stack-1",
  "stack-2",
  "stack-3",
  // overlapping frames
  "overlap-a",
  "overlap-b",
  // floating / bordered / inset
  "pip",
  "floating",
  "bordered",
  "inset",
  "band",
  "tall-inset",
  // sliding panels
  "panel-left",
  "panel-right",
  // mosaic
  "mosaic-a",
  "mosaic-b",
  "mosaic-c",
  // contact sheet (3x3-ish)
  "sheet-1",
  "sheet-2",
  "sheet-3",
  "sheet-4",
  // film strip
  "strip-1",
  "strip-2",
  "strip-3",
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const ANIMATIONS = [
  "none",
  "punch_in",
  "push_in",
  "slow_push_in",
  "aggressive_push_in",
  "pull_out",
  "slide_left",
  "slide_right",
  "slide_up",
  "slide_down",
  "snap_zoom",
  "scale_bounce",
  "elastic_scale",
  "overshoot",
  "bounce",
  "snap_move",
  "drift",
  "pan_left",
  "pan_right",
  "pan_up",
  "pan_down",
  "freeze",
  "blur_in",
  "mask_reveal",
  "expand",
  "collapse",
  "subtle_rotate",
  "rotate_snap",
  "float",
  "perspective_tilt",
  "handheld",
  "smear_in",
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
  "punch_zoom",
  "match_zoom",
  "snap_zoom_out",
  "directional_blur",
  "slide_out",
  "push_out",
  "rotate_out",
  "mask_wipe",
  "shape_wipe",
  "expand_frame",
  "collapse_frame",
  "film_splice",
  "rgb_split",
  "blur_pulse",
  "stretch",
  "smear",
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
  | "cta_lockup"
  | "word_by_word"
  | "tracking_in"
  | "vertical_type"
  | "ticker"
  | "outlined"
  | "giant_word"
  | "stat_callout"
  | "subtitle"
  | "highlight_bar";

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
  /** inspector overrides — all optional, template defaults win when absent */
  fontKey?: string;
  fontWeight?: number;
  sizeScale?: number;
  lineHeight?: number;
  tracking?: number;
  x?: number;
  y?: number;
  rotation?: number;
  color?: string;
  stroke?: number;
  strokeColor?: string;
  shadow?: number;
  background?: string;
  opacity?: number;
  animSpeed?: number;
}


export type OverlayType =
  | "flash"
  | "bar_wipe"
  | "grain"
  | "vignette"
  | "progress"
  | "frame_line"
  | "halation"
  | "light_leak"
  | "camcorder"
  | "timestamp"
  | "chromatic"
  | "blur_pulse"
  | "bloom"
  | "film_border"
  | "paper"
  | "noise"
  | "posterize"
  | "rgb_separation";

export interface Overlay {
  type: OverlayType;
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

/** The authored idea a template is built around. */
export interface CreativeDirection {
  conceptKey: string;
  conceptName: string;
  creativeIdea: string;
  pacingStrategy: string;
  visualMotif: string;
  transitionMotif: string;
  typographyMotif: string;
  layoutMotif: string;
  openingStrategy: string;
  middleStrategy: string;
  endingStrategy: string;
  surpriseMoment: string;
  surpriseKind: SurpriseKind;
  surpriseAt: number;
  restraintRules: string[];
  fontKey: string;
  rhythmKey: string;
  textureKeys: string[];
}

export type SurpriseKind =
  | "split_screen"
  | "freeze_frame"
  | "typography_takeover"
  | "three_shot_burst"
  | "layout_collapse"
  | "film_strip"
  | "unexpected_pause"
  | "frame_within_frame"
  | "giant_word"
  | "abrupt_scale";

export interface Palette {
  bg: string;
  ink: string;
  accent: string;
}

/** An executable creative moment layered over the footage. */
export interface CreativeEvent {
  id: string;
  /** kernel id from the capability layer */
  kernel: string;
  /** technique id it was instantiated from, when it came from the library */
  techniqueId?: string;
  label?: string;
  start: number;
  duration: number;
  params: Record<string, number | string>;
  /** below text/graphics or above everything */
  layer?: "under_text" | "over_all";
  word?: string;
  seed?: number;
  opacity?: number;
}

/** The 4-stage pipeline's plan for a template, kept for DNA + critique. */
export interface EditPlan {
  intent: string;
  beats: { at: number; move: string }[];
  techniques: string[];
  criticNotes: string[];
  criticScore: number;
  geometryRatio: number;
}


/** An imported motion asset (SVG/PNG/WebM/Lottie/GIF) placed on the timeline. */
export type BlendMode =
  | "normal"
  | "screen"
  | "multiply"
  | "overlay"
  | "lighten"
  | "difference"
  | "soft-light";

export interface MotionAssetEvent {
  id: string;
  assetId: string;
  /** which semantic motion slot filled this, when it came from a blueprint */
  slotKey?: string;
  label?: string;
  start: number;
  duration: number;
  scale: number;
  x: number;
  y: number;
  opacity: number;
  rotation?: number;
  blend?: BlendMode;
  loop?: boolean;
  reverse?: boolean;
  speed?: number;
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
  /** Google font key from the font library. */
  fontKey?: string;
  direction?: CreativeDirection;
  graphicSlots?: GraphicSlot[];
  creativeEvents?: CreativeEvent[];
  editPlan?: EditPlan;
  /** id of the source template when this is a version / sync variant */
  parentId?: string;
  versionLabel?: string;
  /** imported motion assets placed over the edit */
  motionAssets?: MotionAssetEvent[];
  /** end card used for the closing block */
  endCardId?: string;
  /** approved type systems the generator drew from */
  typeSystemIds?: string[];
  /** blueprint motion slot key -> chosen motion kit item / asset id */
  motionSlotPlan?: Record<string, string>;
  /** structural blueprint this spec was built on */
  blueprintId?: string;
  /** simple project logo placement */
  logo?: LogoSpec;
}

/** A user-uploaded transparent logo placed over the edit. */
export interface LogoSpec {
  /** key into the MediaMap holding the logo image */
  mediaKey: string;
  position: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  scale: number;
  /** when the logo is on screen */
  appearances: { start: number; duration: number; hero?: boolean }[];
}


export type GraphicKind =
  | "line"
  | "circle"
  | "rect"
  | "arrow"
  | "scribble"
  | "star"
  | "cross"
  | "grid"
  | "label"
  | "badge"
  | "border"
  | "film_frame"
  | "underline"
  | "highlight_bar"
  | "counter"
  | "number"
  | "timestamp"
  | "sticker"
  | "editorial_mark"
  | "progress_bar"
  | "ticker"
  | "corner";

export type GraphicAnimation =
  | "pop"
  | "draw"
  | "slide"
  | "fade"
  | "spin"
  | "pulse"
  | "snap";

export interface GraphicSlot {
  id: string;
  kind: GraphicKind;
  label?: string;
  text?: string;
  start: number;
  duration: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color?: string;
  opacity: number;
  animation: GraphicAnimation;
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
  /** inspector controls */
  rotation?: number;
  speed?: number;
  opacity?: number;
  volume?: number;
  fit?: "cover" | "contain";
  flipX?: boolean;
  flipY?: boolean;
}

export type MediaMap = Record<string, MediaAssignment>;

/** Uploaded music + analysed structure. */
export interface BeatEvent {
  time: number;
  kind: "minorBeat" | "strongBeat" | "downbeat" | "transient" | "energyShift" | "drop" | "phraseChange";
  strength: number;
}

export interface BeatMap {
  bpm: number;
  confidence: number;
  duration: number;
  events: BeatEvent[];
}

export interface AudioTrack {
  url: string;
  name: string;
  duration: number;
  trimStart: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  beatMap: BeatMap | null;
}


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
    const cur = spine[i]!;
    const prev = spine[i - 1]!;
    const gap = cur.start - (prev.start + prev.duration);
    if (gap > 0.35) errors.push(`gap before ${cur.id}`);
  }
  for (const t of spec.textSlots) {
    if (t.start + t.duration > spec.duration + 0.001)
      errors.push(`${t.id}: text exceeds duration`);
  }
  return errors;
}