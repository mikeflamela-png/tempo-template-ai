import type { BeatMap, TemplateSpec } from "@/lib/template/types";

export const SHOT_TYPES = [
  "hero",
  "product",
  "detail",
  "lifestyle",
  "action",
  "environment",
  "transition",
  "other",
] as const;

export type ShotType = (typeof SHOT_TYPES)[number];

export const SHOT_TYPE_LABEL: Record<ShotType, string> = {
  hero: "Hero",
  product: "Product",
  detail: "Detail",
  lifestyle: "Lifestyle",
  action: "Action",
  environment: "Environment",
  transition: "Transition",
  other: "Other",
};

/** A source file the user uploaded. Blob lives in IndexedDB, never duplicated. */
export interface SourceRecord {
  id: string;
  projectId: string;
  name: string;
  duration: number;
  kind: "stringout" | "clip";
  addedAt: number;
}

/**
 * A virtual subclip: a pointer into a source file plus review metadata.
 * No video data is copied — only timestamps.
 */
export interface Clip {
  id: string;
  projectId: string;
  sourceId: string;
  name: string;
  /** detected shot bounds inside the source, seconds */
  start: number;
  end: number;
  /** user trim inside [start, end] */
  in: number;
  out: number;
  rating: number; // 0 = unrated, 1..5
  favorite: boolean;
  rejected: boolean;
  shotType: ShotType | null;
  /** small jpeg data url */
  thumb?: string;
  order: number;
}

export function clipLength(c: Clip) {
  return Math.max(0.1, c.out - c.in);
}

export interface MusicRecord {
  id: string;
  name: string;
  duration: number;
  beatMap: BeatMap | null;
  peaks: number[];
}

export interface EditVersion {
  id: string;
  name: string;
  createdAt: number;
  favorite: boolean;
  spec: TemplateSpec;
  /** slotId -> clipId */
  plan: Record<string, string>;
  /** slotId -> source in-point (seconds) */
  offsets?: Record<string, number>;
  settings: MakeSettings;
}

export type EffectLevel = "none" | "light" | "medium";
export type FormatKey = "9:16" | "16:9" | "1:1";

export interface MakeSettings {
  duration: number;
  format: FormatKey;
  styleKey: string;
  effects: EffectLevel;
  count: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  kind: "stringout" | "clips" | null;
  music: MusicRecord | null;
  versions: EditVersion[];
  lastSettings: MakeSettings | null;
}

export const FORMATS: { key: FormatKey; label: string; width: number; height: number }[] = [
  { key: "9:16", label: "9:16", width: 1080, height: 1920 },
  { key: "16:9", label: "16:9", width: 1920, height: 1080 },
  { key: "1:1", label: "1:1", width: 1080, height: 1080 },
];
