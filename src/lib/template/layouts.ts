import type { Layout } from "./types";

export interface LayoutBox {
  left: string;
  top: string;
  width: string;
  height: string;
  /** optional polygon clip applied to the frame */
  clip?: string;
  /** frame treatment */
  frame?: "none" | "hairline" | "thick" | "shadow";
  radius?: number;
  rotate?: number;
}

const box = (
  left: number,
  top: number,
  width: number,
  height: number,
  extra: Partial<LayoutBox> = {},
): LayoutBox => ({
  left: `${left}%`,
  top: `${top}%`,
  width: `${width}%`,
  height: `${height}%`,
  ...extra,
});

export const LAYOUT_BOXES: Record<Layout, LayoutBox> = {
  full: box(0, 0, 100, 100),

  "split-left": box(0, 0, 50, 100),
  "split-right": box(50, 0, 50, 100),
  "split-top": box(0, 0, 100, 50),
  "split-bottom": box(0, 50, 100, 50),

  "diag-left": box(0, 0, 100, 100, { clip: "polygon(0 0, 62% 0, 38% 100%, 0 100%)" }),
  "diag-right": box(0, 0, 100, 100, { clip: "polygon(62% 0, 100% 0, 100% 100%, 38% 100%)" }),

  "col-1": box(0, 0, 33.34, 100),
  "col-2": box(33.33, 0, 33.34, 100),
  "col-3": box(66.66, 0, 33.34, 100),

  "grid-tl": box(0, 0, 50, 50),
  "grid-tr": box(50, 0, 50, 50),
  "grid-bl": box(0, 50, 50, 50),
  "grid-br": box(50, 50, 50, 50),

  "stack-1": box(0, 4, 100, 30, { frame: "hairline" }),
  "stack-2": box(0, 35, 100, 30, { frame: "hairline" }),
  "stack-3": box(0, 66, 100, 30, { frame: "hairline" }),

  "overlap-a": box(4, 16, 62, 44, { frame: "shadow", radius: 8, rotate: -2 }),
  "overlap-b": box(30, 44, 64, 44, { frame: "shadow", radius: 8, rotate: 2 }),

  pip: box(56, 10, 38, 26, { frame: "thick", radius: 10 }),
  floating: box(8, 56, 48, 34, { frame: "shadow", radius: 14 }),
  bordered: box(9, 14, 82, 62, { frame: "thick", radius: 0 }),
  inset: box(14, 26, 72, 42, { frame: "hairline", radius: 4 }),
  band: box(0, 30, 100, 40),
  "tall-inset": box(58, 46, 36, 42, { frame: "shadow", radius: 10 }),

  "panel-left": box(0, 18, 46, 64, { frame: "hairline" }),
  "panel-right": box(54, 18, 46, 64, { frame: "hairline" }),

  "mosaic-a": box(0, 0, 62, 56),
  "mosaic-b": box(62, 0, 38, 56),
  "mosaic-c": box(0, 56, 100, 44),

  "sheet-1": box(6, 12, 42, 30, { frame: "hairline", radius: 2 }),
  "sheet-2": box(52, 12, 42, 30, { frame: "hairline", radius: 2 }),
  "sheet-3": box(6, 46, 42, 30, { frame: "hairline", radius: 2 }),
  "sheet-4": box(52, 46, 42, 30, { frame: "hairline", radius: 2 }),

  "strip-1": box(3, 22, 30, 40, { frame: "thick", radius: 2 }),
  "strip-2": box(35, 22, 30, 40, { frame: "thick", radius: 2 }),
  "strip-3": box(67, 22, 30, 40, { frame: "thick", radius: 2 }),
};

/** Named layout groups the creative director composes with. */
export const LAYOUT_GROUPS = {
  full: ["full"],
  verticalSplit: ["split-left", "split-right"],
  horizontalSplit: ["split-top", "split-bottom"],
  diagonal: ["diag-left", "diag-right"],
  threeUp: ["col-1", "col-2", "col-3"],
  quad: ["grid-tl", "grid-tr", "grid-bl", "grid-br"],
  stacked: ["stack-1", "stack-2", "stack-3"],
  overlapping: ["overlap-a", "overlap-b"],
  floating: ["floating", "pip", "tall-inset"],
  framed: ["bordered", "inset", "band"],
  panels: ["panel-left", "panel-right"],
  mosaic: ["mosaic-a", "mosaic-b", "mosaic-c"],
  contactSheet: ["sheet-1", "sheet-2", "sheet-3", "sheet-4"],
  filmStrip: ["strip-1", "strip-2", "strip-3"],
} satisfies Record<string, Layout[]>;

export type LayoutGroupKey = keyof typeof LAYOUT_GROUPS;
