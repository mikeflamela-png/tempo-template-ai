import { useSyncExternalStore } from "react";
import { getMedia, putMedia, mediaUrl } from "./db";
import { registerRuntimeFont, type FontDef } from "@/lib/template/fonts";

/**
 * Fonts the user uploaded for text. Files live in the footage blob db, the
 * index is persisted alongside them, and every font is re-registered on load
 * so it can be reused in any project.
 */
const INDEX_KEY = "tempo-uploaded-fonts:v1";

export interface UploadedFont {
  id: string;
  key: string;
  name: string;
  family: string;
}

let fonts: UploadedFont[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  void putMedia(INDEX_KEY, new Blob([JSON.stringify(fonts)], { type: "application/json" }));
}

async function register(font: UploadedFont) {
  const url = await mediaUrl(font.id);
  if (!url) return;
  const def: FontDef = {
    key: font.key,
    name: font.name,
    stack: `'${font.family}', system-ui, sans-serif`,
    category: "Minimal",
    google: "",
    display: { weight: 500, tracking: 0, uppercase: false, scale: 1 },
  };
  registerRuntimeFont(def);
  try {
    const face = new FontFace(font.family, `url(${url})`);
    await face.load();
    (document.fonts as FontFaceSet).add(face);
  } catch {
    /* preview falls back to the system stack */
  }
}

export function loadUploadedFonts() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  void (async () => {
    try {
      const blob = await getMedia(INDEX_KEY);
      if (blob) fonts = JSON.parse(await blob.text()) as UploadedFont[];
    } catch {
      fonts = [];
    }
    await Promise.all(fonts.map(register));
    emit();
  })();
}

export function useUploadedFonts() {
  loadUploadedFonts();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => fonts,
    () => [] as UploadedFont[],
  );
}

export async function addUploadedFont(file: File): Promise<UploadedFont> {
  const id = `fnt-${Date.now().toString(36)}`;
  const name = file.name.replace(/\.[a-z0-9]+$/i, "");
  const font: UploadedFont = { id, key: `up-${id}`, name, family: `Tempo ${name}` };
  await putMedia(id, file);
  fonts = [...fonts, font];
  persist();
  await register(font);
  emit();
  return font;
}
