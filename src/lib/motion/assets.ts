/**
 * MOTION ASSET LIBRARY
 *
 * Imported motion assets (film burns, light leaks, grain, arrows, stickers…)
 * live here: localStorage metadata + IndexedDB blobs, same pattern as brand
 * assets/fonts. Assets get filed into a quality tier so generation can lean
 * hard on the reliable "core" set and only reach for riskier material when
 * asked to.
 */
import { useSyncExternalStore } from "react";
import { deleteBlob, getBlob, putBlob } from "@/lib/brand/db";

export type MotionAssetCategory =
  | "film burn"
  | "light leak"
  | "grain"
  | "texture"
  | "arrow"
  | "handwriting"
  | "scribble"
  | "title"
  | "transition overlay"
  | "background"
  | "sfx"
  | "sticker"
  | "other";

export const MOTION_ASSET_CATEGORIES: MotionAssetCategory[] = [
  "film burn",
  "light leak",
  "grain",
  "texture",
  "arrow",
  "handwriting",
  "scribble",
  "title",
  "transition overlay",
  "background",
  "sfx",
  "sticker",
  "other",
];

export type MotionAssetQuality = "core" | "specialty" | "experimental" | "retired";
export const MOTION_ASSET_QUALITIES: MotionAssetQuality[] = [
  "core",
  "specialty",
  "experimental",
  "retired",
];

export type BlendModeName =
  | "normal"
  | "screen"
  | "multiply"
  | "overlay"
  | "lighten"
  | "difference"
  | "soft-light";

export interface MotionAssetStats {
  uses: number;
  keeps: number;
  removals: number;
  favorites: number;
  failures: number;
  badFeedback: number;
}

export interface MotionAsset {
  id: string;
  name: string;
  category: MotionAssetCategory;
  mime: string;
  fileName: string;
  tags: string[];
  durationSec: number;
  defaultScale: number;
  defaultX: number;
  defaultY: number;
  defaultOpacity: number;
  blend: BlendModeName;
  loop: boolean;
  reverse: boolean;
  speed: number;
  quality: MotionAssetQuality;
  brandId?: string;
  compatibleStyles: string[];
  usageRules: string[];
  kitKeys: string[];
  createdAt: number;
  stats: MotionAssetStats;
  /** session object URL, rebuilt from IndexedDB on load */
  url?: string;
}

export type AssetKindResolved = "image" | "video" | "lottie" | "svg" | "audio";

export function assetKind(asset: Pick<MotionAsset, "mime" | "fileName">): AssetKindResolved {
  const mime = asset.mime || "";
  const name = asset.fileName.toLowerCase();
  if (mime.includes("svg") || name.endsWith(".svg")) return "svg";
  if (mime.includes("json") || name.endsWith(".json") || name.endsWith(".lottie")) return "lottie";
  if (mime.startsWith("video/") || name.endsWith(".webm") || name.endsWith(".mov") || name.endsWith(".mp4"))
    return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/.test(name)) return "audio";
  return "image";
}

interface MotionAssetState {
  assets: MotionAsset[];
}

const KEY = "tempo.motion-assets.v1";
const empty: MotionAssetState = { assets: [] };
let state: MotionAssetState = empty;
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        assets: state.assets.map(({ url: _url, ...rest }) => rest),
      }),
    );
  } catch {
    /* ignore */
  }
}

function commit(next: MotionAssetState) {
  state = next;
  persist();
  notify();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as MotionAssetState) };
  } catch {
    /* ignore */
  }
  void (async () => {
    for (const asset of state.assets) {
      const blob = await getBlob(asset.id);
      if (blob) asset.url = URL.createObjectURL(blob);
    }
    notify();
  })();
}

export function useMotionAssets() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  ).assets;
}

export function motionAssetById(id?: string | null): MotionAsset | undefined {
  hydrate();
  return state.assets.find((a) => a.id === id);
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

function measureMediaDuration(file: File, kind: AssetKindResolved): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || (kind !== "video" && kind !== "audio")) {
      resolve(0);
      return;
    }
    const el = document.createElement(kind === "video" ? "video" : "audio");
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    const timeout = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 4000);
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      clearTimeout(timeout);
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      cleanup();
      resolve(d || 0);
    };
    el.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(0);
    };
  });
}

function inferCategory(fileName: string): MotionAssetCategory {
  const n = fileName.toLowerCase();
  if (n.includes("burn")) return "film burn";
  if (n.includes("leak")) return "light leak";
  if (n.includes("grain") || n.includes("noise")) return "grain";
  if (n.includes("texture") || n.includes("paper")) return "texture";
  if (n.includes("arrow")) return "arrow";
  if (n.includes("hand") || n.includes("write")) return "handwriting";
  if (n.includes("scribble") || n.includes("doodle")) return "scribble";
  if (n.includes("title") || n.includes("lower-third")) return "title";
  if (n.includes("transition") || n.includes("wipe")) return "transition overlay";
  if (n.includes("bg") || n.includes("background")) return "background";
  if (n.includes("sfx") || n.includes("sound") || n.includes("whoosh")) return "sfx";
  if (n.includes("sticker") || n.includes("badge")) return "sticker";
  return "other";
}

export async function importMotionAsset(
  file: File,
  patch: Partial<MotionAsset> = {},
): Promise<MotionAsset> {
  hydrate();
  const id = uid("motion");
  await putBlob(id, file);
  const mime = file.type || "application/octet-stream";
  const kind = assetKind({ mime, fileName: file.name });
  const durationSec = patch.durationSec ?? (await measureMediaDuration(file, kind));
  const asset: MotionAsset = {
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    category: inferCategory(file.name),
    mime,
    fileName: file.name,
    tags: [],
    durationSec,
    defaultScale: 1,
    defaultX: 0,
    defaultY: 0,
    defaultOpacity: 1,
    blend: kind === "video" || kind === "image" ? "screen" : "normal",
    loop: kind === "video" || kind === "audio",
    reverse: false,
    speed: 1,
    quality: "specialty",
    compatibleStyles: [],
    usageRules: [],
    kitKeys: [],
    createdAt: Date.now(),
    stats: { uses: 0, keeps: 0, removals: 0, favorites: 0, failures: 0, badFeedback: 0 },
    url: URL.createObjectURL(file),
    ...patch,
  };
  commit({ ...state, assets: [asset, ...state.assets] });
  return asset;
}

export function updateMotionAsset(id: string, patch: Partial<MotionAsset>) {
  hydrate();
  commit({
    ...state,
    assets: state.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  });
}

export function deleteMotionAsset(id: string) {
  hydrate();
  void deleteBlob(id);
  commit({ ...state, assets: state.assets.filter((a) => a.id !== id) });
}

export function addToKit(id: string, kitKey: string) {
  hydrate();
  const asset = motionAssetById(id);
  if (!asset || asset.kitKeys.includes(kitKey)) return;
  updateMotionAsset(id, { kitKeys: [...asset.kitKeys, kitKey] });
}

export function removeFromKit(id: string, kitKey: string) {
  hydrate();
  const asset = motionAssetById(id);
  if (!asset) return;
  updateMotionAsset(id, { kitKeys: asset.kitKeys.filter((k) => k !== kitKey) });
}

export type AssetStatKey = keyof MotionAssetStats;

export function recordAssetStat(id: string, key: AssetStatKey) {
  hydrate();
  const asset = motionAssetById(id);
  if (!asset) return;
  updateMotionAsset(id, { stats: { ...asset.stats, [key]: asset.stats[key] + 1 } });
}

export interface PickAssetsOptions {
  categories?: MotionAssetCategory[];
  styleTags?: string[];
  brandId?: string;
  bold?: boolean;
  count?: number;
  rng?: () => number;
}

/** Weighted picker: strongly favors "core", "specialty" only on style match, "experimental" only when bold, never "retired". */
export function pickAssetsForSlot(opts: PickAssetsOptions = {}): MotionAsset[] {
  hydrate();
  const { categories, styleTags = [], brandId, bold = false, count = 1, rng = Math.random } = opts;
  const pool = state.assets.filter((a) => {
    if (a.quality === "retired") return false;
    if (categories && categories.length > 0 && !categories.includes(a.category)) return false;
    if (brandId && a.brandId && a.brandId !== brandId) return false;
    if (a.quality === "experimental" && !bold) return false;
    if (a.quality === "specialty") {
      const matches = a.compatibleStyles.some((s) => styleTags.includes(s));
      if (!matches) return false;
    }
    return true;
  });
  const weight = (a: MotionAsset) => {
    if (a.quality === "core") return 10;
    if (a.quality === "specialty") return 4;
    return 1; // experimental (already filtered by bold)
  };
  const chosen: MotionAsset[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const total = remaining.reduce((sum, a) => sum + weight(a), 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < remaining.length; idx++) {
      r -= weight(remaining[idx]!);
      if (r <= 0) break;
    }
    const picked = remaining.splice(Math.min(idx, remaining.length - 1), 1)[0];
    if (picked) chosen.push(picked);
  }
  return chosen;
}

export interface LibraryHealthEntry {
  asset: MotionAsset;
  reason: string;
}

/** Flags poor performers without deleting anything — purely advisory. */
export function libraryHealth(): LibraryHealthEntry[] {
  hydrate();
  const flags: LibraryHealthEntry[] = [];
  for (const a of state.assets) {
    if (a.quality === "retired") continue;
    const { uses, removals, failures, badFeedback } = a.stats;
    if (uses >= 5 && removals / Math.max(1, uses) > 0.6) {
      flags.push({ asset: a, reason: "consider retiring — removed more often than kept" });
    } else if (failures >= 3) {
      flags.push({ asset: a, reason: "consider retiring — repeated render failures" });
    } else if (badFeedback >= 3) {
      flags.push({ asset: a, reason: "consider retiring — repeated negative feedback" });
    }
  }
  return flags;
}
