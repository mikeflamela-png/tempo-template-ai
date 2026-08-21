/**
 * SIMPLE STYLES
 *
 * The seven styles a normal user picks from in Quick Mode. Each one resolves
 * to the deeper systems that already exist — StylePack, MotionPack, creative
 * source, effect budget and the direction controls — so choosing a style
 * materially changes the edit without exposing any internals.
 */
export interface SimpleStyle {
  key: string;
  name: string;
  blurb: string;
  /** STYLE_PACKS key */
  stylePackKey: string;
  /** MOTION_PACKS key chosen automatically for this style */
  motionPackKey: string;
  creativeSource: "curated" | "balanced" | "tempo" | "mixed";
  effectAmount: number;
  energy: string;
  pacing: string;
  typography: string;
  transitionIntensity: string;
  layoutComplexity: string;
  complexity: string;
  risk: number;
  /** allowed to draw on experimental / Creative Lab material */
  allowsExperimental?: boolean;
}

export const SIMPLE_STYLES: SimpleStyle[] = [
  {
    key: "clean",
    name: "Clean",
    blurb: "Minimal effects, clean type, hard cuts, product stays visible.",
    stylePackKey: "clean_tech",
    motionPackKey: "documentary_still",
    creativeSource: "curated",
    effectAmount: 2,
    energy: "Minimal",
    pacing: "Medium",
    typography: "Minimal",
    transitionIntensity: "Mostly Cuts",
    layoutComplexity: "Full Screen",
    complexity: "Simple",
    risk: 2,
  },
  {
    key: "editorial",
    name: "Editorial",
    blurb: "Strong typography, irregular pacing, crop marks, photo framing.",
    stylePackKey: "editorial_fashion",
    motionPackKey: "editorial_paper",
    creativeSource: "curated",
    effectAmount: 4,
    energy: "Cinematic",
    pacing: "Medium",
    typography: "Moderate",
    transitionIntensity: "Subtle",
    layoutComplexity: "Occasional Layouts",
    complexity: "Creative",
    risk: 4,
  },
  {
    key: "filmic",
    name: "Filmic",
    blurb: "Film texture, burns and leaks, slower holds, analog grade.",
    stylePackKey: "film_90s",
    motionPackKey: "analog_film",
    creativeSource: "curated",
    effectAmount: 5,
    energy: "Cinematic",
    pacing: "Slow",
    typography: "Minimal",
    transitionIntensity: "Subtle",
    layoutComplexity: "Full Screen",
    complexity: "Creative",
    risk: 4,
  },
  {
    key: "raw_social",
    name: "Raw Social",
    blurb: "Jump cuts, freezes, scribbles, oversized captions, native rhythm.",
    stylePackKey: "street_kinetic",
    motionPackKey: "type_forward",
    creativeSource: "balanced",
    effectAmount: 6,
    energy: "Playful",
    pacing: "Fast",
    typography: "Heavy",
    transitionIntensity: "Creative",
    layoutComplexity: "Occasional Layouts",
    complexity: "Creative",
    risk: 5,
  },
  {
    key: "high_energy",
    name: "High Energy",
    blurb: "Fast rhythm, impact frames, strong transitions, bold type.",
    stylePackKey: "night_club",
    motionPackKey: "kinetic_flash",
    creativeSource: "balanced",
    effectAmount: 7,
    energy: "Aggressive",
    pacing: "Very Fast",
    typography: "Moderate",
    transitionIntensity: "Aggressive",
    layoutComplexity: "Dynamic Layouts",
    complexity: "Creative",
    risk: 6,
  },
  {
    key: "luxury",
    name: "Luxury",
    blurb: "Slow pacing, almost no effects, controlled product hero.",
    stylePackKey: "luxury_minimal",
    motionPackKey: "quiet_luxury",
    creativeSource: "curated",
    effectAmount: 1,
    energy: "Minimal",
    pacing: "Slow",
    typography: "Minimal",
    transitionIntensity: "Mostly Cuts",
    layoutComplexity: "Full Screen",
    complexity: "Simple",
    risk: 2,
  },
  {
    key: "experimental",
    name: "Experimental",
    blurb: "High-risk treatments, Creative Lab material, strange motion.",
    stylePackKey: "riso_print",
    motionPackKey: "type_forward",
    creativeSource: "mixed",
    effectAmount: 8,
    energy: "Playful",
    pacing: "Dynamic",
    typography: "Heavy",
    transitionIntensity: "Aggressive",
    layoutComplexity: "Dynamic Layouts",
    complexity: "Experimental",
    risk: 9,
    allowsExperimental: true,
  },
];

export const simpleStyleByKey = (key?: string | null) =>
  SIMPLE_STYLES.find((s) => s.key === key) ?? null;

/**
 * Four intentionally different creative angles on the same brief. Quick Mode
 * generates one edit per lane so the results are never four versions of the
 * same timeline — while all four stay inside the chosen style.
 */
export interface GenerationLane {
  key: string;
  label: string;
  description: string;
  /** deltas applied on top of the style's resolved options */
  energy?: string;
  pacing?: string;
  typography?: string;
  layoutComplexity?: string;
  transitionIntensity?: string;
  effectDelta: number;
  riskDelta: number;
}

export const QUICK_LANES: GenerationLane[] = [
  {
    key: "product_led",
    label: "Product led",
    description: "Clean shots, restrained treatment, the product carries it.",
    typography: "Minimal",
    layoutComplexity: "Full Screen",
    transitionIntensity: "Mostly Cuts",
    effectDelta: -2,
    riskDelta: -1,
  },
  {
    key: "type_led",
    label: "Typography led",
    description: "Words drive the edit, footage supports the line.",
    typography: "Heavy",
    effectDelta: -1,
    riskDelta: 0,
  },
  {
    key: "lifestyle_led",
    label: "Lifestyle led",
    description: "Longer holds, texture, mood over information.",
    pacing: "Slow",
    layoutComplexity: "Full Screen",
    effectDelta: 0,
    riskDelta: 1,
  },
  {
    key: "social_native",
    label: "Social native",
    description: "Faster, looser, feels shot and cut for the feed.",
    pacing: "Fast",
    energy: "Playful",
    transitionIntensity: "Creative",
    effectDelta: 1,
    riskDelta: 2,
  },
];
