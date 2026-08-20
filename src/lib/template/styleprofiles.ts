/**
 * STYLE PROFILES
 *
 * A StylePack (stylepacks.ts) is the surface-level skin (palette/font/
 * overlays/grade). A StyleProfile is the *creative brief* behind it: which
 * motion kit it prefers, which imported asset categories it wants vs
 * forbids, how it likes to cut, and how hard it's allowed to lean on
 * effects. generate.ts and compose.ts read this to make style/creative
 * controls actually change the edit, not just its colors.
 */
import type { OverlayType, TextStyleName, Transition } from "./types";
import type { MotionAssetCategory } from "@/lib/motion/assets";
import { MOTION_PACKS } from "@/lib/motion/packs";

export type Pacing = "irregular" | "precise" | "slow" | "fast";

export interface StyleProfile {
  key: string;
  /** MOTION_PACKS key this style leans on by default */
  recommendedPackKey: string;
  /** MOTION_PACKS keys this style is allowed to draw from at all */
  allowedPackKeys: string[];
  preferredAssetCategories: MotionAssetCategory[];
  discouragedAssetCategories: MotionAssetCategory[];
  /** matched against MotionAsset.compatibleStyles */
  styleTags: string[];
  transitions: Transition[];
  overlays: OverlayType[];
  /** overlay types this style must never carry, even if requested elsewhere */
  discouragedOverlays: OverlayType[];
  textStyles: TextStyleName[];
  fontCategory: string;
  fontKey: string;
  pacing: Pacing;
  cutFrequencyPerMin: number;
  textureAmount: number; // 0-1
  graphicDensity: number; // 0-1
  motionIntensity: number; // 0-1
  effectBudgetMultiplier: number;
  openingBehavior: string;
  endingBehavior: string;
  colorGrade: string;
  /** 0-1 multiplier applied to how many creative events survive trimming */
  creativeEventFrequency: number;
  musicRelationship: string;
}

export const STYLE_PROFILES: Record<string, StyleProfile> = {
  editorial_fashion: {
    key: "editorial_fashion",
    recommendedPackKey: "editorial_paper",
    allowedPackKeys: ["editorial_paper", "documentary_still", "quiet_luxury"],
    preferredAssetCategories: ["title", "handwriting", "texture"],
    discouragedAssetCategories: ["sticker", "sfx"],
    styleTags: ["editorial_fashion", "editorial", "restrained"],
    transitions: ["hard_cut", "mask_wipe", "wipe_left"],
    overlays: ["frame_line", "grain", "vignette"],
    discouragedOverlays: ["chromatic", "rgb_separation", "posterize"],
    textStyles: ["edge_aligned", "minimal_caption", "centered_statement"],
    fontCategory: "Editorial",
    fontKey: "instrument",
    pacing: "precise",
    cutFrequencyPerMin: 22,
    textureAmount: 0.3,
    graphicDensity: 0.25,
    motionIntensity: 0.3,
    effectBudgetMultiplier: 0.7,
    openingBehavior: "quiet cold open on a single asymmetric frame",
    endingBehavior: "hairline rule closes on a still hero shot",
    colorGrade: "sepia(0.12) contrast(1.05)",
    creativeEventFrequency: 0.45,
    musicRelationship: "understated, sits under the edit",
  },
  film_90s: {
    key: "film_90s",
    recommendedPackKey: "analog_film",
    allowedPackKeys: ["analog_film", "documentary_still"],
    preferredAssetCategories: ["film burn", "light leak", "grain", "texture"],
    discouragedAssetCategories: ["sticker", "arrow"],
    styleTags: ["film_90s", "analog", "film", "grain"],
    transitions: ["hard_cut", "film_splice", "flash", "blur"],
    overlays: ["halation", "grain", "timestamp", "film_border", "light_leak"],
    discouragedOverlays: ["progress", "frame_line"],
    textStyles: ["subtitle", "minimal_caption", "ticker"],
    fontCategory: "Technical",
    fontKey: "space-mono",
    pacing: "irregular",
    cutFrequencyPerMin: 30,
    textureAmount: 0.85,
    graphicDensity: 0.35,
    motionIntensity: 0.55,
    effectBudgetMultiplier: 1.0,
    openingBehavior: "flash of a burn before the first frame settles",
    endingBehavior: "timestamp holds through a splice out",
    colorGrade: "saturate(1.15) contrast(1.08) sepia(0.08)",
    creativeEventFrequency: 0.85,
    musicRelationship: "hisses/tape-warmth leaning into the grade",
  },
  luxury_minimal: {
    key: "luxury_minimal",
    recommendedPackKey: "quiet_luxury",
    allowedPackKeys: ["quiet_luxury", "documentary_still"],
    preferredAssetCategories: ["texture", "light leak"],
    discouragedAssetCategories: ["sticker", "arrow", "scribble", "handwriting"],
    styleTags: ["luxury_minimal", "luxury", "restrained"],
    transitions: ["hard_cut", "blur", "mask_out"],
    overlays: ["vignette", "bloom"],
    discouragedOverlays: ["chromatic", "rgb_separation", "noise", "posterize", "paper"],
    textStyles: ["centered_statement", "tracking_in", "minimal_caption"],
    fontCategory: "Luxury",
    fontKey: "italiana",
    pacing: "slow",
    cutFrequencyPerMin: 10,
    textureAmount: 0.05,
    graphicDensity: 0.1,
    motionIntensity: 0.2,
    effectBudgetMultiplier: 0.35,
    openingBehavior: "slow push into darkness before the reveal",
    endingBehavior: "long unhurried hold, no effects in the last beat",
    colorGrade: "contrast(1.04) brightness(0.98)",
    creativeEventFrequency: 0.2,
    musicRelationship: "spacious, leads the pace",
  },
  street_kinetic: {
    key: "street_kinetic",
    recommendedPackKey: "kinetic_flash",
    allowedPackKeys: ["kinetic_flash", "type_forward"],
    preferredAssetCategories: ["scribble", "sticker", "handwriting"],
    discouragedAssetCategories: ["light leak", "background"],
    styleTags: ["street_kinetic", "raw", "social", "kinetic"],
    transitions: ["whip", "rgb_split", "flash", "snap_zoom_out", "stretch"],
    overlays: ["chromatic", "flash", "bar_wipe", "noise"],
    discouragedOverlays: ["bloom", "vignette"],
    textStyles: ["oversized_hook", "giant_word", "kinetic_words"],
    fontCategory: "Bold / Condensed",
    fontKey: "archivo-black",
    pacing: "irregular",
    cutFrequencyPerMin: 42,
    textureAmount: 0.4,
    graphicDensity: 0.6,
    motionIntensity: 0.9,
    effectBudgetMultiplier: 1.3,
    openingBehavior: "jump cut straight into the hook, no build-up",
    endingBehavior: "freeze frame slams into an oversized caption",
    colorGrade: "contrast(1.14) saturate(1.1)",
    creativeEventFrequency: 1.0,
    musicRelationship: "drives the cut, hits land on beats",
  },
  clean_tech: {
    key: "clean_tech",
    recommendedPackKey: "documentary_still",
    allowedPackKeys: ["documentary_still", "editorial_paper"],
    preferredAssetCategories: ["title", "transition overlay"],
    discouragedAssetCategories: ["grain", "texture", "scribble", "handwriting", "film burn"],
    styleTags: ["clean_tech", "tech", "minimal", "precise"],
    transitions: ["hard_cut", "mask_wipe", "wipe_up"],
    overlays: ["frame_line", "progress"],
    discouragedOverlays: ["grain", "paper", "noise", "posterize", "halation", "light_leak", "film_border"],
    textStyles: ["feature_callout", "stat_callout", "minimal_caption"],
    fontCategory: "Minimal",
    fontKey: "inter-tight",
    pacing: "precise",
    cutFrequencyPerMin: 20,
    textureAmount: 0.02,
    graphicDensity: 0.4,
    motionIntensity: 0.35,
    effectBudgetMultiplier: 0.45,
    openingBehavior: "clean mask reveal on a grid line",
    endingBehavior: "labels resolve into a single crisp callout",
    colorGrade: "contrast(1.05) saturate(0.95)",
    creativeEventFrequency: 0.35,
    musicRelationship: "clicky, quantized, sits precisely on cuts",
  },
  sun_bleached: {
    key: "sun_bleached",
    recommendedPackKey: "quiet_luxury",
    allowedPackKeys: ["quiet_luxury", "analog_film"],
    preferredAssetCategories: ["light leak", "grain", "texture"],
    discouragedAssetCategories: ["sticker", "arrow"],
    styleTags: ["sun_bleached", "warm", "drift"],
    transitions: ["hard_cut", "blur", "mask_out"],
    overlays: ["light_leak", "grain", "bloom"],
    discouragedOverlays: ["chromatic", "rgb_separation", "posterize"],
    textStyles: ["minimal_caption", "stagger_reveal", "subtitle"],
    fontCategory: "Minimal",
    fontKey: "jost",
    pacing: "slow",
    cutFrequencyPerMin: 14,
    textureAmount: 0.55,
    graphicDensity: 0.15,
    motionIntensity: 0.3,
    effectBudgetMultiplier: 0.6,
    openingBehavior: "soft light leak washes in over the first frame",
    endingBehavior: "drifts to a warm, slightly overexposed hold",
    colorGrade: "sepia(0.18) brightness(1.03) saturate(1.05)",
    creativeEventFrequency: 0.4,
    musicRelationship: "unhurried, sun-warmed tone",
  },
  riso_print: {
    key: "riso_print",
    recommendedPackKey: "editorial_paper",
    allowedPackKeys: ["editorial_paper", "type_forward"],
    preferredAssetCategories: ["texture", "scribble", "title"],
    discouragedAssetCategories: ["film burn", "light leak"],
    styleTags: ["riso_print", "paper", "posterized"],
    transitions: ["hard_cut", "mask_wipe", "film_splice"],
    overlays: ["paper", "posterize", "noise"],
    discouragedOverlays: ["halation", "light_leak", "bloom"],
    textStyles: ["highlight_bar", "outlined", "giant_word"],
    fontCategory: "Retro",
    fontKey: "alfa",
    pacing: "irregular",
    cutFrequencyPerMin: 26,
    textureAmount: 0.7,
    graphicDensity: 0.65,
    motionIntensity: 0.5,
    effectBudgetMultiplier: 0.85,
    openingBehavior: "posterised cut-paper collage assembles into frame",
    endingBehavior: "stamps a highlight bar over the final word",
    colorGrade: "contrast(1.2) saturate(1.25)",
    creativeEventFrequency: 0.65,
    musicRelationship: "playful, syncopated",
  },
  night_club: {
    key: "night_club",
    recommendedPackKey: "kinetic_flash",
    allowedPackKeys: ["kinetic_flash", "type_forward"],
    preferredAssetCategories: ["sfx", "transition overlay"],
    discouragedAssetCategories: ["handwriting", "texture"],
    styleTags: ["night_club", "neon", "strobe"],
    transitions: ["whip", "rgb_split", "flash", "blur_pulse"],
    overlays: ["rgb_separation", "flash", "blur_pulse", "grain"],
    discouragedOverlays: ["paper", "vignette"],
    textStyles: ["kinetic_words", "word_by_word", "oversized_hook"],
    fontCategory: "Technical",
    fontKey: "chakra",
    pacing: "fast",
    cutFrequencyPerMin: 46,
    textureAmount: 0.3,
    graphicDensity: 0.55,
    motionIntensity: 0.95,
    effectBudgetMultiplier: 1.2,
    openingBehavior: "strobe flash before the beat drops",
    endingBehavior: "rgb split freezes on the CTA",
    colorGrade: "contrast(1.18) saturate(1.3)",
    creativeEventFrequency: 0.95,
    musicRelationship: "leads everything, strobes land on the beat",
  },
};

export function styleProfileFor(key?: string | null): StyleProfile | null {
  if (!key) return null;
  return STYLE_PROFILES[key] ?? null;
}

export function recommendedPackFor(styleKey?: string | null) {
  const profile = styleProfileFor(styleKey);
  if (!profile) return null;
  return MOTION_PACKS.find((p) => p.key === profile.recommendedPackKey) ?? null;
}
