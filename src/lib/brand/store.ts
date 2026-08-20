/**
 * BRAND KIT + COPY KIT
 *
 * Brand Kits hold the real files that make a brand look like itself: uploaded
 * fonts, logos, product cutouts, textures and colors, plus the usage rules the
 * generator has to respect. Copy Kits hold the exact words allowed in a video.
 */
import { useSyncExternalStore } from "react";
import { deleteBlob, getBlob, putBlob } from "./db";
import { registerRuntimeFont, unregisterRuntimeFont, type FontDef } from "@/lib/template/fonts";

export type BrandFontRole = "display" | "secondary" | "body" | "accent";
export const FONT_ROLES: BrandFontRole[] = ["display", "secondary", "body", "accent"];

export type FontLoadStatus = "pending" | "loaded" | "error";

export interface BrandFont {
  id: string;
  name: string;
  fileName: string;
  role: BrandFontRole;
  /** css family + font key used across the renderer */
  family: string;
  uppercase: boolean;
  tracking: number;
  status: FontLoadStatus;
  error?: string;
}

export type AssetKind =
  | "logo"
  | "product"
  | "graphic"
  | "icon"
  | "texture"
  | "overlay"
  | "endcard";

export const ASSET_KINDS: AssetKind[] = [
  "logo",
  "product",
  "graphic",
  "icon",
  "texture",
  "overlay",
  "endcard",
];

export type UsageRule =
  | "always available"
  | "preferred"
  | "rare"
  | "only in end card"
  | "only for product moments"
  | "do not animate"
  | "may animate"
  | "hero asset"
  | "background only";

export const USAGE_RULES: UsageRule[] = [
  "always available",
  "preferred",
  "rare",
  "only in end card",
  "only for product moments",
  "do not animate",
  "may animate",
  "hero asset",
  "background only",
];

export interface BrandAsset {
  id: string;
  name: string;
  fileName: string;
  kind: AssetKind;
  mime: string;
  tags: string[];
  rule: UsageRule;
  favorite?: boolean;
  /** session object URL, rebuilt from IndexedDB on load */
  url?: string;
}

export interface BrandColors {
  bg: string;
  ink: string;
  accent: string;
  secondary: string;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: BrandColors;
  fonts: BrandFont[];
  assets: BrandAsset[];
  ctas: string[];
  /** 0–10, how much motion this brand tolerates */
  animationIntensity: number;
  motionPackKeys: string[];
  notes?: string;
  createdAt: number;
}

export type CopyMode = "exact" | "shorten" | "variations";

export interface CopyKit {
  id: string;
  name: string;
  brandId?: string;
  hook: string;
  headline: string;
  support: string;
  feature: string;
  offer: string;
  cta: string;
  extras: string[];
  mode: CopyMode;
}

interface BrandState {
  kits: BrandKit[];
  copyKits: CopyKit[];
  activeKitId: string | null;
  activeCopyId: string | null;
}

const KEY = "tempo.brand.v1";
const empty: BrandState = { kits: [], copyKits: [], activeKitId: null, activeCopyId: null };
let state: BrandState = empty;
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        ...state,
        kits: state.kits.map((k) => ({
          ...k,
          assets: k.assets.map(({ url: _url, ...rest }) => rest),
          fonts: k.fonts.map((f) => ({ ...f, status: "pending" as FontLoadStatus })),
        })),
      }),
    );
  } catch {
    /* ignore */
  }
}

function commit(next: BrandState) {
  state = next;
  persist();
  notify();
}

function fontDef(f: BrandFont): FontDef {
  return {
    key: f.id,
    name: f.name,
    stack: `'${f.family}', system-ui, sans-serif`,
    category: "Minimal",
    google: "",
    display: { weight: 700, tracking: f.tracking, uppercase: f.uppercase, scale: 1 },
  };
}

async function loadFont(f: BrandFont) {
  const blob = await getBlob(f.id);
  if (!blob) {
    patchFont(f.id, { status: "error", error: "font file missing from local storage" });
    return;
  }
  try {
    const url = URL.createObjectURL(blob);
    const face = new FontFace(f.family, `url(${url})`);
    await face.load();
    (document as unknown as { fonts: FontFaceSet }).fonts.add(face);
    registerRuntimeFont(fontDef(f));
    patchFont(f.id, { status: "loaded" });
  } catch (e) {
    patchFont(f.id, { status: "error", error: (e as Error).message });
  }
}

function patchFont(id: string, patch: Partial<BrandFont>) {
  state = {
    ...state,
    kits: state.kits.map((k) => ({
      ...k,
      fonts: k.fonts.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),
  };
  notify();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as BrandState) };
  } catch {
    /* ignore */
  }
  // rebuild object URLs + font faces from IndexedDB
  void (async () => {
    for (const kit of state.kits) {
      for (const asset of kit.assets) {
        const blob = await getBlob(asset.id);
        if (blob) asset.url = URL.createObjectURL(blob);
      }
      for (const font of kit.fonts) await loadFont(font);
    }
    notify();
  })();
}

export function useBrandStore() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}

export function brandById(id?: string | null) {
  hydrate();
  return state.kits.find((k) => k.id === id);
}

/** All brand kits — used by asset resolution and export bundling. */
export function brandKits(): BrandKit[] {
  hydrate();
  return state.kits;
}

export function copyKitById(id?: string | null) {
  hydrate();
  return state.copyKits.find((k) => k.id === id);
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

export function createBrandKit(name: string): BrandKit {
  hydrate();
  const kit: BrandKit = {
    id: uid("brand"),
    name,
    colors: { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54", secondary: "#8b8b93" },
    fonts: [],
    assets: [],
    ctas: [],
    animationIntensity: 4,
    motionPackKeys: [],
    createdAt: Date.now(),
  };
  commit({ ...state, kits: [kit, ...state.kits], activeKitId: kit.id });
  return kit;
}

export function updateBrandKit(id: string, patch: Partial<BrandKit>) {
  hydrate();
  commit({ ...state, kits: state.kits.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
}

export function deleteBrandKit(id: string) {
  hydrate();
  const kit = brandById(id);
  kit?.assets.forEach((a) => void deleteBlob(a.id));
  kit?.fonts.forEach((f) => {
    void deleteBlob(f.id);
    unregisterRuntimeFont(f.id);
  });
  commit({
    ...state,
    kits: state.kits.filter((k) => k.id !== id),
    activeKitId: state.activeKitId === id ? null : state.activeKitId,
  });
}

export function setActiveBrand(id: string | null) {
  hydrate();
  commit({ ...state, activeKitId: id });
}

export function setActiveCopy(id: string | null) {
  hydrate();
  commit({ ...state, activeCopyId: id });
}

const FONT_EXT = /\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/;

export async function addBrandFont(kitId: string, file: File, role: BrandFontRole) {
  hydrate();
  if (!FONT_EXT.test(file.name)) throw new Error("Only .ttf, .otf, .woff and .woff2 are supported");
  const id = uid("font");
  await putBlob(id, file);
  const font: BrandFont = {
    id,
    name: file.name.replace(FONT_EXT, ""),
    fileName: file.name,
    role,
    family: `TempoBrand_${id.replace(/[^a-z0-9]/gi, "")}`,
    uppercase: role === "display",
    tracking: role === "display" ? -2 : 0,
    status: "pending",
  };
  commit({
    ...state,
    kits: state.kits.map((k) => (k.id === kitId ? { ...k, fonts: [...k.fonts, font] } : k)),
  });
  await loadFont(font);
  persist();
}

export function removeBrandFont(kitId: string, fontId: string) {
  hydrate();
  void deleteBlob(fontId);
  unregisterRuntimeFont(fontId);
  commit({
    ...state,
    kits: state.kits.map((k) =>
      k.id === kitId ? { ...k, fonts: k.fonts.filter((f) => f.id !== fontId) } : k,
    ),
  });
}

export async function addBrandAsset(
  kitId: string,
  file: File,
  kind: AssetKind,
  rule: UsageRule = "always available",
) {
  hydrate();
  const id = uid("asset");
  await putBlob(id, file);
  const asset: BrandAsset = {
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    fileName: file.name,
    kind,
    mime: file.type || "image/png",
    tags: [kind],
    rule,
    url: URL.createObjectURL(file),
  };
  commit({
    ...state,
    kits: state.kits.map((k) => (k.id === kitId ? { ...k, assets: [...k.assets, asset] } : k)),
  });
}

export function updateBrandAsset(kitId: string, assetId: string, patch: Partial<BrandAsset>) {
  hydrate();
  commit({
    ...state,
    kits: state.kits.map((k) =>
      k.id === kitId
        ? { ...k, assets: k.assets.map((a) => (a.id === assetId ? { ...a, ...patch } : a)) }
        : k,
    ),
  });
}

export function removeBrandAsset(kitId: string, assetId: string) {
  hydrate();
  void deleteBlob(assetId);
  commit({
    ...state,
    kits: state.kits.map((k) =>
      k.id === kitId ? { ...k, assets: k.assets.filter((a) => a.id !== assetId) } : k,
    ),
  });
}

export function saveCopyKit(kit: Omit<CopyKit, "id"> & { id?: string }): CopyKit {
  hydrate();
  const id = kit.id ?? uid("copy");
  const next: CopyKit = { ...kit, id };
  commit({
    ...state,
    copyKits: [next, ...state.copyKits.filter((c) => c.id !== id)],
    activeCopyId: id,
  });
  return next;
}

export function deleteCopyKit(id: string) {
  hydrate();
  commit({
    ...state,
    copyKits: state.copyKits.filter((c) => c.id !== id),
    activeCopyId: state.activeCopyId === id ? null : state.activeCopyId,
  });
}

export function fontWarnings(kit?: BrandKit | null): string[] {
  if (!kit) return [];
  return kit.fonts
    .filter((f) => f.status === "error")
    .map((f) => `${f.fileName} failed to load: ${f.error ?? "unknown error"}`);
}

export function roleFont(kit: BrandKit | undefined, role: BrandFontRole): BrandFont | undefined {
  if (!kit) return undefined;
  return kit.fonts.find((f) => f.role === role && f.status !== "error");
}
