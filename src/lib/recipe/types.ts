/**
 * CREATIVE RECIPE
 *
 * The source of truth for the new Tempo workflow. Every creative decision has
 * an explicit state:
 *
 *   auto     — Tempo chooses, and may vary it between versions
 *   surprise — Tempo chooses, and is allowed a more unusual answer
 *   custom   — the user chose it; it is a HARD CONSTRAINT
 *
 * `locked` additionally survives every future variation pass.
 */

export type ControlState = "auto" | "surprise" | "custom";

export interface Section<T> {
  state: ControlState;
  locked: boolean;
  value: T;
}

export interface FootageRegion {
  /** seconds into the stringout */
  from: number;
  to: number;
  kind: "prefer" | "exclude" | "lock";
}

export interface FootageValue {
  regions: FootageRegion[];
}

export interface StructureValue {
  /** structure key, mapped onto the blueprint system underneath */
  structureKey: string | null;
  /** advanced: exact blueprint id */
  blueprintId: string | null;
}

export type PacingKey = "slow" | "medium" | "fast" | "dynamic";
export type ShotLengthKey = "micro" | "short" | "medium" | "long";

export interface TimingValue {
  duration: number;
  pacing: PacingKey | null;
  shotLength: ShotLengthKey | null;
  /** opening / middle / ending pace arc */
  arc: [PacingKey, PacingKey, PacingKey] | null;
  /** per shot index -> seconds; missing/0 = AUTO */
  shotDurations: Record<number, number>;
}

export type CopyMode = "auto" | "none" | "exact" | "assisted";

export interface CopyValue {
  mode: CopyMode;
  lines: {
    hook: string;
    headline: string;
    feature: string;
    support: string;
    offer: string;
    cta: string;
  };
}

export type TypeMotion = "static" | "subtle" | "kinetic" | "aggressive";

export interface TypeValue {
  useBrandKit: boolean;
  fontKey: string | null;
  weight: number | null;
  sizeScale: number | null;
  uppercase: boolean | null;
  tracking: number | null;
  position: "top" | "center" | "bottom" | null;
  align: "left" | "center" | "right" | null;
  color: string | null;
  motion: TypeMotion | null;
}

export interface StyleValue {
  /** SIMPLE_STYLES key */
  styleKey: string | null;
}

export type MotionFrequency = "once" | "occasionally" | "often";

export interface MotionValue {
  assetIds: string[];
  frequency: MotionFrequency;
  /** Tempo may add supporting effects of its own */
  supporting: boolean;
  /** manual placements: assetId at a fixed time */
  placements: { assetId: string; start: number; duration: number }[];
}

export type BeatSync = "off" | "loose" | "medium" | "strong";

export interface MusicValue {
  beatSync: BeatSync;
  uses: {
    majorCuts: boolean;
    motionHits: boolean;
    textHits: boolean;
    heroReveal: boolean;
    ending: boolean;
  };
  startAt: number;
}

export type EndingKey = "hero_hold" | "logo" | "cta" | "end_card" | "lifestyle";

export interface FinishValue {
  /** 0–10 */
  intensity: number;
  effectDensity: number;
  /** 0 = footage first, 10 = graphics first */
  footagePriority: number;
  polish: "clean" | "textured" | "raw";
  ending: EndingKey | null;
}

export interface CreativeRecipe {
  id: string;
  name: string;
  footage: Section<FootageValue>;
  structure: Section<StructureValue>;
  timing: Section<TimingValue>;
  copy: Section<CopyValue>;
  type: Section<TypeValue>;
  style: Section<StyleValue>;
  motion: Section<MotionValue>;
  music: Section<MusicValue>;
  finish: Section<FinishValue>;
  /** Tempo may not introduce anything not explicitly selected */
  strict: boolean;
  count: number;
  variation: "tight" | "balanced" | "wild";
  brief: string;
  brandId: string | null;
  copyKitId: string | null;
  updatedAt: number;
}

export type SectionKey =
  | "footage"
  | "structure"
  | "timing"
  | "copy"
  | "type"
  | "style"
  | "motion"
  | "music"
  | "finish";

export const SECTION_ORDER: SectionKey[] = [
  "footage",
  "structure",
  "timing",
  "copy",
  "type",
  "style",
  "motion",
  "music",
  "finish",
];

export const SECTION_LABEL: Record<SectionKey, string> = {
  footage: "Footage",
  structure: "Structure",
  timing: "Timing",
  copy: "Copy",
  type: "Type",
  style: "Style",
  motion: "Motion + graphics",
  music: "Music",
  finish: "Finish",
};

export const STRUCTURES: { key: string; label: string; blueprintHint: string[] }[] = [
  { key: "product_led", label: "Product led", blueprintHint: ["product", "hero"] },
  { key: "lifestyle_build", label: "Lifestyle build", blueprintHint: ["lifestyle"] },
  { key: "hook_product", label: "Hook → Product", blueprintHint: ["hook", "product"] },
  { key: "editorial", label: "Editorial", blueprintHint: ["editorial", "fashion"] },
  { key: "story_build", label: "Story build", blueprintHint: ["story"] },
  { key: "montage", label: "Montage", blueprintHint: ["montage", "energy"] },
  { key: "type_led", label: "Type led", blueprintHint: ["type", "typography"] },
  { key: "problem_product", label: "Problem → Product", blueprintHint: ["problem", "product"] },
  { key: "slow_build", label: "Slow build", blueprintHint: ["slow", "luxury"] },
];

function section<T>(value: T): Section<T> {
  return { state: "auto", locked: false, value };
}

export function newRecipe(id = `recipe-${Date.now().toString(36)}`): CreativeRecipe {
  return {
    id,
    name: "Untitled recipe",
    footage: section<FootageValue>({ regions: [] }),
    structure: section<StructureValue>({ structureKey: null, blueprintId: null }),
    timing: section<TimingValue>({
      duration: 10,
      pacing: null,
      shotLength: null,
      arc: null,
      shotDurations: {},
    }),
    copy: section<CopyValue>({
      mode: "auto",
      lines: { hook: "", headline: "", feature: "", support: "", offer: "", cta: "" },
    }),
    type: section<TypeValue>({
      useBrandKit: false,
      fontKey: null,
      weight: null,
      sizeScale: null,
      uppercase: null,
      tracking: null,
      position: null,
      align: null,
      color: null,
      motion: null,
    }),
    style: section<StyleValue>({ styleKey: null }),
    motion: section<MotionValue>({
      assetIds: [],
      frequency: "occasionally",
      supporting: true,
      placements: [],
    }),
    music: section<MusicValue>({
      beatSync: "medium",
      uses: { majorCuts: true, motionHits: true, textHits: false, heroReveal: true, ending: true },
      startAt: 0,
    }),
    finish: section<FinishValue>({
      intensity: 4,
      effectDensity: 4,
      footagePriority: 3,
      polish: "clean",
      ending: null,
    }),
    strict: false,
    count: 4,
    variation: "balanced",
    brief: "",
    brandId: null,
    copyKitId: null,
    updatedAt: Date.now(),
  };
}

/** Sections the user actually pinned down — these become hard constraints. */
export function specifiedSections(r: CreativeRecipe): SectionKey[] {
  return SECTION_ORDER.filter((k) => r[k].state === "custom" || r[k].locked);
}

/** Sections Tempo is still free to decide and vary. */
export function autoSections(r: CreativeRecipe): SectionKey[] {
  return SECTION_ORDER.filter((k) => r[k].state !== "custom" && !r[k].locked);
}
