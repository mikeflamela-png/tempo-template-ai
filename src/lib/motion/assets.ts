/**
 * MOTION ASSET LIBRARY
 *
 * Imported motion assets (film burns, light leaks, grain, arrows, stickers…)
 * live here: localStorage metadata + IndexedDB blobs, same pattern as brand
 * assets/fonts.
 *
 * Every asset carries a CREATIVE TIER. The tier — not randomness — decides how
 * hard generation leans on it:
 *
 *   premium      professionally made / explicitly approved. Preferred ingredient.
 *   core         proven Tempo-native quality material.
 *   supporting   technical helpers (grain, subtle texture) — never the idea.
 *   experimental Creative Lab output. Excluded from production output.
 *   retired      never used.
 *
 * Assets also carry a ROLE so generation only places them where they make
 * sense, and optional USAGE RULES so a good asset can't become cheesy.
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

/** Creative quality tier. */
export type MotionAssetQuality =
  | "premium"
  | "core"
  | "supporting"
  | "experimental"
  | "retired";

export const MOTION_ASSET_QUALITIES: MotionAssetQuality[] = [
  "premium",
  "core",
  "supporting",
  "experimental",
  "retired",
];

export const QUALITY_BLURB: Record<MotionAssetQuality, string> = {
  premium: "Approved professional material — preferred ingredient",
  core: "Proven, professional-looking Tempo material",
  supporting: "Technical helper — composition, not the idea",
  experimental: "Unapproved / lab output — kept out of production",
  retired: "Never used by generation",
};

/** Where an asset belongs in an edit. */
export type MotionAssetRole =
  | "opener"
  | "transition"
  | "overlay"
  | "accent"
  | "text support"
  | "product moment"
  | "texture"
  | "interruption"
  | "ending"
  | "background"
  | "sfx"
  | "multipurpose";

export const MOTION_ASSET_ROLES: MotionAssetRole[] = [
  "opener",
  "transition",
  "overlay",
  "accent",
  "text support",
  "product moment",
  "texture",
  "interruption",
  "ending",
  "background",
  "sfx",
  "multipurpose",
];

export type AssetIntensity = "subtle" | "medium" | "strong";
export type EditSection = "opening" | "middle" | "ending" | "any";

export interface MotionAssetRules {
  maxUses: number;
  minDuration?: number | undefined;
  maxDuration?: number | undefined;
  mayOverlapText: boolean;
  mayOverlapProduct: boolean;
  mayOverlapEffect: boolean;
  preferredSection: EditSection;
  avoidSection?: EditSection | undefined;
  intensity: AssetIntensity;
}

export const DEFAULT_RULES: MotionAssetRules = {
  maxUses: 1,
  mayOverlapText: true,
  mayOverlapProduct: false,
  mayOverlapEffect: false,
  preferredSection: "any",
  intensity: "medium",
};

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
  replaced: number;
}

/** Whether a format is known to survive the server renderer. */
export type RenderCompat = "verified" | "likely" | "player-only";

export interface MotionAsset {
  id: string;
  name: string;
  category: MotionAssetCategory;
  role: MotionAssetRole;
  mime: string;
  fileName: string;
  tags: string[];
  durationSec: number;
  width?: number | undefined;
  height?: number | undefined;
  hasAlpha?: boolean | undefined;
  defaultScale: number;
  defaultX: number;
  defaultY: number;
  defaultOpacity: number;
  blend: BlendModeName;
  loop: boolean;
  reverse: boolean;
  speed: number;
  quality: MotionAssetQuality;
  favorite: boolean;
  rules: MotionAssetRules;
  brandId?: string | undefined;
  compatibleStyles: string[];
  usageRules: string[];
  kitKeys: string[];
  createdAt: number;
  stats: MotionAssetStats;
  /** session object URL, rebuilt from IndexedDB on load */
  url?: string | undefined;
  /** data URL thumbnail so grids never load every blob */
  thumb?: string | undefined;
}

export type AssetKindResolved = "image" | "video" | "lottie" | "svg" | "audio";

export function assetKind(asset: Pick<MotionAsset, "mime" | "fileName">): AssetKindResolved {
  const mime = asset.mime || "";
  const name = asset.fileName.toLowerCase();
  if (mime.includes("svg") || name.endsWith(".svg")) return "svg";
  if (mime.includes("json") || name.endsWith(".json") || name.endsWith(".lottie")) return "lottie";
  if (
    mime.startsWith("video/") ||
    name.endsWith(".webm") ||
    name.endsWith(".mov") ||
    name.endsWith(".mp4")
  )
    return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/.test(name)) return "audio";
  return "image";
}

/**
 * Server-render compatibility. Remotion's OffthreadVideo + Chromium handles
 * webm/mp4/images/svg fine; .mov alpha and Lottie are the risky ones.
 */
export function renderCompat(asset: Pick<MotionAsset, "mime" | "fileName">): {
  level: RenderCompat;
  note: string;
} {
  const name = asset.fileName.toLowerCase();
  const kind = assetKind(asset);
  if (name.endsWith(".mov"))
    return {
      level: "player-only",
      note: "ProRes/.mov alpha often fails server rendering — re-export as WebM (VP9 alpha).",
    };
  if (kind === "lottie")
    return { level: "likely", note: "Lottie renders through the JSON player — verify with a test render." };
  if (kind === "video") return { level: "verified", note: "WebM/MP4 renders reliably." };
  if (kind === "audio") return { level: "verified", note: "Mixed into the render audio bed." };
  return { level: "verified", note: "Still/vector renders reliably." };
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

/** Old tier names → new creative hierarchy. */
function migrateQuality(q: unknown): MotionAssetQuality {
  if (q === "specialty") return "supporting";
  if (
    q === "premium" ||
    q === "core" ||
    q === "supporting" ||
    q === "experimental" ||
    q === "retired"
  )
    return q;
  return "core";
}

function normalize(a: Partial<MotionAsset> & { id: string }): MotionAsset {
  return {
    role: "multipurpose",
    favorite: false,
    tags: [],
    compatibleStyles: [],
    usageRules: [],
    kitKeys: [],
    defaultScale: 1,
    defaultX: 0,
    defaultY: 0,
    defaultOpacity: 1,
    blend: "screen",
    loop: false,
    reverse: false,
    speed: 1,
    durationSec: 0,
    createdAt: Date.now(),
    name: a.fileName ?? "asset",
    fileName: a.fileName ?? "asset",
    mime: "",
    category: "other",
    ...a,
    quality: migrateQuality((a as { quality?: unknown }).quality),
    rules: { ...DEFAULT_RULES, ...(a.rules ?? {}) },
    stats: {
      uses: 0,
      keeps: 0,
      removals: 0,
      favorites: 0,
      failures: 0,
      badFeedback: 0,
      replaced: 0,
      ...(a.stats ?? {}),
    },
  } as MotionAsset;
}

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
    if (raw) {
      const parsed = JSON.parse(raw) as MotionAssetState;
      state = { assets: (parsed.assets ?? []).map((a) => normalize(a)) };
    }
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

export function allMotionAssets(): MotionAsset[] {
  hydrate();
  return state.assets;
}

export function motionAssetById(id?: string | null): MotionAsset | undefined {
  hydrate();
  return state.assets.find((a) => a.id === id);
}

const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

interface Probe {
  duration: number;
  width?: number;
  height?: number;
  thumb?: string;
  hasAlpha?: boolean;
}

/** Reads duration, dimensions, a thumbnail and (best effort) transparency. */
export function probeAsset(file: File): Promise<Probe> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve({ duration: 0 });
    const kind = assetKind({ mime: file.type, fileName: file.name });
    const url = URL.createObjectURL(file);
    const done = (p: Probe) => {
      URL.revokeObjectURL(url);
      resolve(p);
    };
    const bail = setTimeout(() => done({ duration: 0 }), 6000);

    if (kind === "video") {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.muted = true;
      el.src = url;
      el.onloadeddata = () => {
        clearTimeout(bail);
        const w = el.videoWidth;
        const h = el.videoHeight;
        let thumb: string | undefined;
        try {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 240 / Math.max(1, w));
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
          thumb = c.toDataURL("image/jpeg", 0.6);
        } catch {
          /* tainted or unsupported */
        }
        done({
          duration: Number.isFinite(el.duration) ? el.duration : 0,
          width: w,
          height: h,
          hasAlpha: /webm|mov|png/i.test(file.type + file.name),
          ...(thumb ? { thumb } : {}),
        });
      };
      el.onerror = () => {
        clearTimeout(bail);
        done({ duration: 0 });
      };
      return;
    }

    if (kind === "audio") {
      const el = document.createElement("audio");
      el.preload = "metadata";
      el.src = url;
      el.onloadedmetadata = () => {
        clearTimeout(bail);
        done({ duration: Number.isFinite(el.duration) ? el.duration : 0 });
      };
      el.onerror = () => {
        clearTimeout(bail);
        done({ duration: 0 });
      };
      return;
    }

    if (kind === "lottie") {
      clearTimeout(bail);
      void file
        .text()
        .then((t) => {
          const j = JSON.parse(t) as { op?: number; fr?: number; w?: number; h?: number };
          done({
            duration: j.op && j.fr ? j.op / j.fr : 0,
            ...(j.w ? { width: j.w } : {}),
            ...(j.h ? { height: j.h } : {}),
            hasAlpha: true,
          });
        })
        .catch(() => done({ duration: 0 }));
      return;
    }

    // image / svg
    const img = new Image();
    img.onload = () => {
      clearTimeout(bail);
      let thumb: string | undefined;
      try {
        const c = document.createElement("canvas");
        const scale = Math.min(1, 240 / Math.max(1, img.naturalWidth));
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        thumb = c.toDataURL("image/png");
      } catch {
        /* ignore */
      }
      done({
        duration: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
        hasAlpha: /png|webp|gif|svg/i.test(file.type + file.name),
        ...(thumb ? { thumb } : {}),
      });
    };
    img.onerror = () => {
      clearTimeout(bail);
      done({ duration: 0 });
    };
    img.src = url;
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
  if (n.includes("transition") || n.includes("wipe") || n.includes("swipe"))
    return "transition overlay";
  if (n.includes("bg") || n.includes("background")) return "background";
  if (n.includes("sfx") || n.includes("sound") || n.includes("whoosh")) return "sfx";
  if (n.includes("sticker") || n.includes("badge")) return "sticker";
  return "other";
}

const CATEGORY_ROLE: Record<MotionAssetCategory, MotionAssetRole> = {
  "film burn": "transition",
  "light leak": "overlay",
  grain: "texture",
  texture: "texture",
  arrow: "accent",
  handwriting: "text support",
  scribble: "accent",
  title: "opener",
  "transition overlay": "transition",
  background: "background",
  sfx: "sfx",
  sticker: "accent",
  other: "multipurpose",
};

export function suggestRole(category: MotionAssetCategory, fileName = ""): MotionAssetRole {
  const n = fileName.toLowerCase();
  if (n.includes("open") || n.includes("intro")) return "opener";
  if (n.includes("end") || n.includes("outro")) return "ending";
  if (n.includes("product")) return "product moment";
  return CATEGORY_ROLE[category] ?? "multipurpose";
}

export function suggestTags(fileName: string, category: MotionAssetCategory): string[] {
  const words = fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));
  return [...new Set([category.split(" ")[0]!, ...words])].slice(0, 6);
}

export function suggestIntensity(
  category: MotionAssetCategory,
  durationSec: number,
): AssetIntensity {
  if (category === "grain" || category === "texture" || category === "background") return "subtle";
  if (category === "film burn" || category === "transition overlay" || category === "title")
    return "strong";
  return durationSec > 4 ? "subtle" : "medium";
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
  const probe = await probeAsset(file);
  const category = patch.category ?? inferCategory(file.name);
  const durationSec = patch.durationSec ?? probe.duration ?? 0;
  const asset: MotionAsset = normalize({
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    category,
    role: suggestRole(category, file.name),
    mime,
    fileName: file.name,
    tags: suggestTags(file.name, category),
    durationSec,
    ...(probe.width ? { width: probe.width } : {}),
    ...(probe.height ? { height: probe.height } : {}),
    ...(probe.hasAlpha !== undefined ? { hasAlpha: probe.hasAlpha } : {}),
    ...(probe.thumb ? { thumb: probe.thumb } : {}),
    blend: kind === "video" || kind === "image" ? "screen" : "normal",
    loop: kind === "video" || kind === "audio",
    quality: "core",
    rules: { ...DEFAULT_RULES, intensity: suggestIntensity(category, durationSec) },
    url: URL.createObjectURL(file),
    ...patch,
  });
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

/** Bulk field update — used by "Mark as Premium", "Add to pack", etc. */
export function bulkUpdateAssets(ids: string[], patch: Partial<MotionAsset>) {
  hydrate();
  const set = new Set(ids);
  commit({
    ...state,
    assets: state.assets.map((a) => (set.has(a.id) ? { ...a, ...patch } : a)),
  });
}

export function bulkSetQuality(ids: string[], quality: MotionAssetQuality) {
  bulkUpdateAssets(ids, { quality });
}

export function bulkAddToKit(ids: string[], kitKey: string) {
  hydrate();
  const set = new Set(ids);
  commit({
    ...state,
    assets: state.assets.map((a) =>
      set.has(a.id) && !a.kitKeys.includes(kitKey)
        ? { ...a, kitKeys: [...a.kitKeys, kitKey] }
        : a,
    ),
  });
}

export function toggleFavorite(id: string) {
  const a = motionAssetById(id);
  if (!a) return;
  updateMotionAsset(id, {
    favorite: !a.favorite,
    stats: { ...a.stats, favorites: a.stats.favorites + (a.favorite ? 0 : 1) },
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

/* ------------------------------------------------------------------ *
 * CREATIVE SOURCE — one control that replaces several confusing ones.
 * ------------------------------------------------------------------ */

export type CreativeSource = "curated" | "balanced" | "tempo" | "experimental";

export const CREATIVE_SOURCES: {
  key: CreativeSource;
  label: string;
  blurb: string;
}[] = [
  { key: "curated", label: "Curated", blurb: "Strongly favours your approved Premium assets" },
  { key: "balanced", label: "Balanced", blurb: "Mixes Premium assets with Tempo techniques" },
  { key: "tempo", label: "Tempo", blurb: "Mostly native Tempo techniques" },
  { key: "experimental", label: "Experimental", blurb: "Allows Creative Lab material" },
];

/** Target share of creative treatments drawn from imported assets. */
export const SOURCE_MIX: Record<
  CreativeSource,
  { premium: number; core: number; supporting: number; experimental: number }
> = {
  curated: { premium: 0.6, core: 0.25, supporting: 0.15, experimental: 0 },
  balanced: { premium: 0.4, core: 0.4, supporting: 0.2, experimental: 0 },
  tempo: { premium: 0.15, core: 0.6, supporting: 0.25, experimental: 0 },
  experimental: { premium: 0.35, core: 0.3, supporting: 0.15, experimental: 0.2 },
};

const TIER_WEIGHT: Record<CreativeSource, Record<MotionAssetQuality, number>> = {
  curated: { premium: 24, core: 6, supporting: 2, experimental: 0, retired: 0 },
  balanced: { premium: 14, core: 10, supporting: 3, experimental: 0, retired: 0 },
  tempo: { premium: 5, core: 8, supporting: 4, experimental: 0, retired: 0 },
  experimental: { premium: 10, core: 6, supporting: 3, experimental: 6, retired: 0 },
};

/**
 * Learned preference. Favourites lift; repeatedly-removed assets sink — but an
 * asset is never auto-retired.
 */
export function assetScore(a: MotionAsset, source: CreativeSource = "curated"): number {
  let w = TIER_WEIGHT[source][a.quality];
  if (w <= 0) return 0;
  if (a.favorite) w *= 1.8;
  const { uses, keeps, removals, replaced, badFeedback } = a.stats;
  if (uses >= 3) {
    const keepRate = (keeps + 1) / (keeps + removals + replaced + 2);
    w *= 0.5 + keepRate; // 0.5x … 1.5x
  }
  if (badFeedback > 0) w *= Math.max(0.4, 1 - badFeedback * 0.15);
  return Math.max(0.01, w);
}

export interface PickAssetsOptions {
  categories?: MotionAssetCategory[] | undefined;
  roles?: MotionAssetRole[] | undefined;
  styleTags?: string[] | undefined;
  kitKey?: string | null | undefined;
  brandId?: string | undefined;
  source?: CreativeSource | undefined;
  /** exclude assets already placed this many times */
  usedCounts?: Record<string, number> | undefined;
  section?: EditSection | undefined;
  count?: number | undefined;
  rng?: () => number;
}

/**
 * Weighted, role-aware, rules-aware picker. This is the single entry point
 * generation uses when it needs a creative treatment.
 */
export function pickAssetsForSlot(opts: PickAssetsOptions = {}): MotionAsset[] {
  hydrate();
  const {
    categories,
    roles,
    styleTags = [],
    kitKey,
    brandId,
    source = "curated",
    usedCounts = {},
    section = "any",
    count = 1,
    rng = Math.random,
  } = opts;

  const pool = state.assets.filter((a) => {
    if (a.quality === "retired") return false;
    if (a.quality === "experimental" && source !== "experimental") return false;
    if (assetKind(a) === "audio" && !(roles ?? []).includes("sfx")) return false;
    if (categories?.length && !categories.includes(a.category)) return false;
    if (roles?.length && !roles.includes(a.role) && a.role !== "multipurpose") return false;
    if (brandId && a.brandId && a.brandId !== brandId) return false;
    if (kitKey && a.kitKeys.length > 0 && !a.kitKeys.includes(kitKey)) return false;
    if (styleTags.length && a.compatibleStyles.length) {
      if (!a.compatibleStyles.some((s) => styleTags.includes(s))) return false;
    }
    if ((usedCounts[a.id] ?? 0) >= Math.max(1, a.rules.maxUses)) return false;
    if (section !== "any") {
      if (a.rules.avoidSection === section) return false;
      if (a.rules.preferredSection !== "any" && a.rules.preferredSection !== section) return false;
    }
    return true;
  });

  const chosen: MotionAsset[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const weights = remaining.map((a) => assetScore(a, source));
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) break;
    let r = rng() * total;
    let idx = 0;
    for (; idx < remaining.length; idx++) {
      r -= weights[idx]!;
      if (r <= 0) break;
    }
    const picked = remaining.splice(Math.min(idx, remaining.length - 1), 1)[0];
    if (picked) chosen.push(picked);
  }
  return chosen;
}

/** One text query across name, tags, category, role and kit. */
export function searchAssets(assets: MotionAsset[], q: string): MotionAsset[] {
  const query = q.trim().toLowerCase();
  if (!query) return assets;
  const terms = query.split(/\s+/);
  return assets.filter((a) => {
    const hay = [
      a.name,
      a.category,
      a.role,
      a.rules.intensity,
      ...a.tags,
      ...a.kitKeys,
      ...a.compatibleStyles,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
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
      flags.push({ asset: a, reason: "removed more often than kept — consider a lower tier" });
    } else if (failures >= 3) {
      flags.push({ asset: a, reason: "repeated render failures" });
    } else if (badFeedback >= 3) {
      flags.push({ asset: a, reason: "repeated negative feedback" });
    }
    if (renderCompat(a).level === "player-only") {
      flags.push({ asset: a, reason: "may not survive server rendering — re-export as WebM" });
    }
  }
  return flags;
}
