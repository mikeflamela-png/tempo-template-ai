import type { GraphicAnimation, GraphicKind, GraphicSlot } from "./types";

export interface GraphicDef {
  kind: GraphicKind;
  name: string;
  group: "Marks" | "Frames" | "Labels" | "Data" | "Editorial";
  defaultText?: string;
  defaultAnimation: GraphicAnimation;
}

export const GRAPHICS: GraphicDef[] = [
  { kind: "line", name: "Line", group: "Marks", defaultAnimation: "draw" },
  { kind: "circle", name: "Circle", group: "Marks", defaultAnimation: "draw" },
  { kind: "rect", name: "Rectangle", group: "Marks", defaultAnimation: "pop" },
  { kind: "arrow", name: "Arrow", group: "Marks", defaultAnimation: "slide" },
  { kind: "scribble", name: "Scribble", group: "Marks", defaultAnimation: "draw" },
  { kind: "star", name: "Star", group: "Marks", defaultAnimation: "pop" },
  { kind: "cross", name: "Cross", group: "Marks", defaultAnimation: "snap" },
  { kind: "grid", name: "Grid", group: "Frames", defaultAnimation: "fade" },
  { kind: "label", name: "Label", group: "Labels", defaultText: "NEW", defaultAnimation: "slide" },
  { kind: "badge", name: "Badge", group: "Labels", defaultText: "01", defaultAnimation: "pop" },
  { kind: "border", name: "Border", group: "Frames", defaultAnimation: "draw" },
  { kind: "film_frame", name: "Film frame", group: "Frames", defaultAnimation: "fade" },
  { kind: "underline", name: "Underline", group: "Editorial", defaultAnimation: "draw" },
  { kind: "highlight_bar", name: "Highlight bar", group: "Editorial", defaultText: "HERO", defaultAnimation: "slide" },
  { kind: "counter", name: "Counter", group: "Data", defaultText: "100", defaultAnimation: "fade" },
  { kind: "number", name: "Big number", group: "Data", defaultText: "03", defaultAnimation: "snap" },
  { kind: "timestamp", name: "Timestamp", group: "Data", defaultAnimation: "fade" },
  { kind: "sticker", name: "Sticker", group: "Labels", defaultText: "NEW DROP", defaultAnimation: "spin" },
  { kind: "editorial_mark", name: "Editorial mark", group: "Editorial", defaultText: "—", defaultAnimation: "fade" },
  { kind: "progress_bar", name: "Progress bar", group: "Data", defaultAnimation: "draw" },
  { kind: "ticker", name: "Ticker", group: "Editorial", defaultText: "TEMPO · TEMPO · TEMPO", defaultAnimation: "slide" },
  { kind: "corner", name: "Corner marks", group: "Frames", defaultAnimation: "pop" },
];

export const GRAPHIC_ANIMATIONS: GraphicAnimation[] = [
  "pop",
  "draw",
  "slide",
  "fade",
  "spin",
  "pulse",
  "snap",
];

export function graphicByKind(kind: GraphicKind) {
  return GRAPHICS.find((g) => g.kind === kind) ?? GRAPHICS[0]!;
}

export function makeGraphic(kind: GraphicKind, start: number, duration = 1.2): GraphicSlot {
  const def = graphicByKind(kind);
  return {
    id: `g-${kind}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label: def.name,
    ...(def.defaultText ? { text: def.defaultText } : {}),
    start: Number(start.toFixed(2)),
    duration,

    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    animation: def.defaultAnimation,
  };
}
