export type FontCategory =
  | "Bold / Condensed"
  | "Editorial"
  | "Minimal"
  | "Playful"
  | "Technical"
  | "Luxury"
  | "Retro";

export interface FontDef {
  key: string;
  name: string;
  /** css font-family stack */
  stack: string;
  category: FontCategory;
  /** google fonts css2 family spec */
  google: string;
  display: {
    weight: number;
    tracking: number;
    uppercase: boolean;
    /** multiplier applied to base type sizes */
    scale: number;
  };
}

export const FONTS: FontDef[] = [
  // Bold / Condensed
  f("archivo-black", "Archivo Black", "'Archivo Black', Impact, sans-serif", "Bold / Condensed", "Archivo+Black", 400, -3, true, 1),
  f("anton", "Anton", "'Anton', Impact, sans-serif", "Bold / Condensed", "Anton", 400, -2, true, 1.06),
  f("bebas", "Bebas Neue", "'Bebas Neue', Impact, sans-serif", "Bold / Condensed", "Bebas+Neue", 400, 1, true, 1.2),
  f("oswald", "Oswald", "'Oswald', sans-serif", "Bold / Condensed", "Oswald:wght@400;600;700", 700, -1, true, 1.05),
  // Editorial
  f("playfair", "Playfair Display", "'Playfair Display', Georgia, serif", "Editorial", "Playfair+Display:ital,wght@0,400;0,700;0,900;1,400", 700, -2, false, 0.92),
  f("instrument", "Instrument Serif", "'Instrument Serif', Georgia, serif", "Editorial", "Instrument+Serif:ital@0;1", 400, -2, false, 1),
  f("dm-serif", "DM Serif Display", "'DM Serif Display', Georgia, serif", "Editorial", "DM+Serif+Display:ital@0;1", 400, -1, false, 0.96),
  f("libre-cas", "Libre Caslon", "'Libre Caslon Display', Georgia, serif", "Editorial", "Libre+Caslon+Display", 400, 0, false, 0.92),
  // Minimal
  f("inter-tight", "Inter Tight", "'Inter Tight', system-ui, sans-serif", "Minimal", "Inter+Tight:wght@300;500;700;900", 600, -2, false, 0.95),
  f("jost", "Jost", "'Jost', system-ui, sans-serif", "Minimal", "Jost:wght@300;400;600;800", 500, 1, true, 0.98),
  f("manrope", "Manrope", "'Manrope', system-ui, sans-serif", "Minimal", "Manrope:wght@300;500;800", 600, -1, false, 0.95),
  // Playful
  f("fredoka", "Fredoka", "'Fredoka', sans-serif", "Playful", "Fredoka:wght@400;600;700", 600, -1, false, 1),
  f("bowlby", "Bowlby One SC", "'Bowlby One SC', cursive", "Playful", "Bowlby+One+SC", 400, 0, true, 0.9),
  f("caprasimo", "Caprasimo", "'Caprasimo', cursive", "Playful", "Caprasimo", 400, -1, false, 0.95),
  // Technical
  f("space-mono", "Space Mono", "'Space Mono', monospace", "Technical", "Space+Mono:wght@400;700", 700, 0, true, 0.8),
  f("jetbrains", "JetBrains Mono", "'JetBrains Mono', monospace", "Technical", "JetBrains+Mono:wght@300;500;800", 500, -1, true, 0.78),
  f("chakra", "Chakra Petch", "'Chakra Petch', sans-serif", "Technical", "Chakra+Petch:wght@400;600;700", 700, 1, true, 0.95),
  // Luxury
  f("cormorant", "Cormorant Garamond", "'Cormorant Garamond', Georgia, serif", "Luxury", "Cormorant+Garamond:ital,wght@0,300;0,500;0,700;1,300", 400, 4, true, 1),
  f("italiana", "Italiana", "'Italiana', Georgia, serif", "Luxury", "Italiana", 400, 8, true, 1),
  f("marcellus", "Marcellus", "'Marcellus', Georgia, serif", "Luxury", "Marcellus", 400, 6, true, 0.95),
  // Retro
  f("righteous", "Righteous", "'Righteous', cursive", "Retro", "Righteous", 400, 0, true, 0.95),
  f("monoton", "Monoton", "'Monoton', cursive", "Retro", "Monoton", 400, 2, true, 0.8),
  f("alfa", "Alfa Slab One", "'Alfa Slab One', serif", "Retro", "Alfa+Slab+One", 400, -1, true, 0.9),
];

function f(
  key: string,
  name: string,
  stack: string,
  category: FontCategory,
  google: string,
  weight: number,
  tracking: number,
  uppercase: boolean,
  scale: number,
): FontDef {
  return { key, name, stack, category, google, display: { weight, tracking, uppercase, scale } };
}

export const FONT_CATEGORIES: FontCategory[] = [
  "Bold / Condensed",
  "Editorial",
  "Minimal",
  "Playful",
  "Technical",
  "Luxury",
  "Retro",
];

export const DEFAULT_FONT = FONTS[0]!;

export function fontByKey(key?: string): FontDef {
  return FONTS.find((x) => x.key === key) ?? DEFAULT_FONT;
}

export function fontsIn(category: FontCategory): FontDef[] {
  return FONTS.filter((x) => x.category === category);
}

/** Single stylesheet URL loading the whole library. */
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  FONTS.map((x) => `family=${x.google}`).join("&") +
  "&display=swap";
