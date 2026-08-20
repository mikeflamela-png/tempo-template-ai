import type { OverlayType, Palette, TemplateSpec, TextStyleName } from "./types";

export interface StylePack {
  key: string;
  name: string;
  blurb: string;
  palette: Palette;
  fontKey: string;
  /** overlays layered on every template in the pack */
  overlays: OverlayType[];
  /** text styles the pack prefers */
  textStyles: TextStyleName[];
  /** grade applied as a wash over the whole piece */
  grade: string;
}

export const STYLE_PACKS: StylePack[] = [
  {
    key: "editorial_fashion",
    name: "Editorial Fashion",
    blurb: "Cream paper, hairline rules, serif display, restrained motion.",
    palette: { bg: "#100e0c", ink: "#f3ece2", accent: "#c8a26a" },
    fontKey: "instrument",
    overlays: ["frame_line", "grain", "vignette"],
    textStyles: ["edge_aligned", "minimal_caption", "centered_statement"],
    grade: "sepia(0.12) contrast(1.05)",
  },
  {
    key: "film_90s",
    name: "90s Film",
    blurb: "Halation, heavy grain, timestamp furniture, warm blown highlights.",
    palette: { bg: "#0d0b09", ink: "#f6efe3", accent: "#e0503a" },
    fontKey: "space-mono",
    overlays: ["halation", "grain", "timestamp", "film_border"],
    textStyles: ["subtitle", "minimal_caption", "ticker"],
    grade: "saturate(1.15) contrast(1.08) sepia(0.08)",
  },
  {
    key: "luxury_minimal",
    name: "Luxury Minimal",
    blurb: "Deep black, wide tracking, slow pushes, almost no furniture.",
    palette: { bg: "#08070a", ink: "#efeae4", accent: "#b9a48a" },
    fontKey: "italiana",
    overlays: ["vignette", "bloom"],
    textStyles: ["centered_statement", "tracking_in", "minimal_caption"],
    grade: "contrast(1.04) brightness(0.98)",
  },
  {
    key: "street_kinetic",
    name: "Street Kinetic",
    blurb: "Hard cuts, oversized condensed type, chromatic snap, high contrast.",
    palette: { bg: "#0a0a0a", ink: "#ffffff", accent: "#d6ff3f" },
    fontKey: "archivo-black",
    overlays: ["chromatic", "flash", "bar_wipe", "noise"],
    textStyles: ["oversized_hook", "giant_word", "kinetic_words"],
    grade: "contrast(1.14) saturate(1.1)",
  },
  {
    key: "clean_tech",
    name: "Clean Tech",
    blurb: "Grid discipline, mono labels, crisp snaps, cool neutrals.",
    palette: { bg: "#0b0e11", ink: "#e8edf2", accent: "#4d8dff" },
    fontKey: "inter-tight",
    overlays: ["frame_line", "progress"],
    textStyles: ["feature_callout", "stat_callout", "minimal_caption"],
    grade: "contrast(1.05) saturate(0.95)",
  },
  {
    key: "sun_bleached",
    name: "Sun Bleached",
    blurb: "Washed warmth, soft light leaks, unhurried drift.",
    palette: { bg: "#12100d", ink: "#fdf6ea", accent: "#f08a4b" },
    fontKey: "jost",
    overlays: ["light_leak", "grain", "bloom"],
    textStyles: ["minimal_caption", "stagger_reveal", "subtitle"],
    grade: "sepia(0.18) brightness(1.03) saturate(1.05)",
  },
  {
    key: "riso_print",
    name: "Riso Print",
    blurb: "Posterised duotone, paper texture, cut-paper layouts.",
    palette: { bg: "#efe7d8", ink: "#141210", accent: "#ff4b3e" },
    fontKey: "alfa",
    overlays: ["paper", "posterize", "noise"],
    textStyles: ["highlight_bar", "outlined", "giant_word"],
    grade: "contrast(1.2) saturate(1.25)",
  },
  {
    key: "night_club",
    name: "Night Club",
    blurb: "Blown neon, rgb separation, strobing flashes, tight cutting.",
    palette: { bg: "#06060a", ink: "#f2f0ff", accent: "#ff2e88" },
    fontKey: "chakra",
    overlays: ["rgb_separation", "flash", "blur_pulse", "grain"],
    textStyles: ["kinetic_words", "word_by_word", "oversized_hook"],
    grade: "contrast(1.18) saturate(1.3)",
  },
];

export const stylePackByKey = (key?: string | null) =>
  STYLE_PACKS.find((p) => p.key === key) ?? null;

/** Re-skins a generated template so a batch reads as one coherent collection. */
export function applyStylePack(spec: TemplateSpec, pack: StylePack): TemplateSpec {
  const styles = pack.textStyles;
  return {
    ...spec,
    palette: pack.palette,
    fontKey: pack.fontKey,
    tags: [...new Set([...spec.tags, pack.name])],
    textSlots: spec.textSlots.map((t, i) => ({
      ...t,
      style: styles[i % styles.length] ?? t.style,
    })),
    overlays: [
      ...spec.overlays.filter((o) => pack.overlays.includes(o.type)),
      ...pack.overlays.slice(0, 3).map((type, i) => ({
        type,
        start: i === 0 ? 0 : spec.duration * 0.02,
        duration: spec.duration,
      })),
    ],
  };
}
