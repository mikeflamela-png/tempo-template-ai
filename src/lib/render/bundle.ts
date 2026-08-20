/**
 * RENDER BUNDLE
 *
 * A remote renderer cannot read the browser's IndexedDB, so every file the
 * Player uses has to travel with the job: source clips, music, imported motion
 * assets, brand logos/product shots used by End Cards, and uploaded brand
 * fonts. This module gathers them into one multipart body and the metadata the
 * worker needs to hand them back to the composition as plain URLs.
 */
import { getBlob } from "@/lib/brand/db";
import { allMotionAssets, assetKind } from "@/lib/motion/assets";
import { brandKits } from "@/lib/brand/store";
import type { BrandKit } from "@/lib/brand/store";
import type { AssetKindResolved } from "@/lib/motion/assets";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";
import { collectAssetRefs } from "./resolve";

export interface AssetMetaEntry {
  kind: AssetKindResolved;
  fileName: string;
  loop?: boolean;
  speed?: number;
}

export interface FontMetaEntry {
  key: string;
  family: string;
  fileName: string;
}

export interface BundleResult {
  form: FormData;
  assetMeta: Record<string, AssetMetaEntry>;
  fonts: FontMetaEntry[];
  missing: string[];
  bytes: number;
}

async function blobFor(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

/**
 * Builds the multipart body for a render job. `onProgress` reports 0..1 while
 * files are read out of the browser stores.
 */
export async function buildRenderBundle(opts: {
  spec: TemplateSpec;
  media: MediaMap;
  audio: AudioTrack | null;
  brand?: BrandKit | null | undefined;
  onProgress?: (fraction: number, label: string) => void;
}): Promise<BundleResult> {
  const { spec, media, audio, brand, onProgress } = opts;
  const form = new FormData();
  const assetMeta: Record<string, AssetMetaEntry> = {};
  const fonts: FontMetaEntry[] = [];
  const missing: string[] = [];
  let bytes = 0;

  const mediaEntries = Object.entries(media);
  const assetIds = collectAssetRefs(spec);
  const brandFonts = (brand ? [brand] : brandKits()).flatMap((k) => k.fonts);
  const total = mediaEntries.length + assetIds.length + brandFonts.length + (audio?.url ? 1 : 0);
  let done = 0;
  const tick = (label: string) => {
    done += 1;
    onProgress?.(done / Math.max(1, total), label);
  };

  for (const [slotId, asset] of mediaEntries) {
    const blob = await blobFor(asset.url);
    bytes += blob.size;
    form.append(`media:${slotId}`, blob, asset.name || slotId);
    tick("footage");
  }

  if (audio?.url) {
    const blob = await blobFor(audio.url);
    bytes += blob.size;
    form.append("audio", blob, audio.name || "audio");
    tick("music");
  }

  const motion = allMotionAssets();
  for (const id of assetIds) {
    const asset = motion.find((a) => a.id === id);
    const brandAsset = asset
      ? null
      : brandKits()
          .flatMap((k) => k.assets)
          .find((a) => a.id === id);
    const blob = await getBlob(id);
    if (!blob) {
      missing.push(asset?.name ?? brandAsset?.name ?? id);
      tick("graphics");
      continue;
    }
    const fileName = asset?.fileName ?? brandAsset?.fileName ?? id;
    bytes += blob.size;
    form.append(`asset:${id}`, blob, fileName);
    assetMeta[id] = {
      kind: assetKind({ mime: asset?.mime ?? brandAsset?.mime ?? blob.type, fileName }),
      fileName,
      ...(asset?.loop ? { loop: true } : {}),
      ...(asset && asset.speed !== 1 ? { speed: asset.speed } : {}),
    };
    tick("graphics");
  }

  for (const font of brandFonts) {
    const blob = await getBlob(font.id);
    if (!blob) {
      missing.push(font.fileName);
      tick("fonts");
      continue;
    }
    bytes += blob.size;
    form.append(`font:${font.id}`, blob, font.fileName);
    fonts.push({ key: font.id, family: font.family, fileName: font.fileName });
    tick("fonts");
  }

  return { form, assetMeta, fonts, missing, bytes };
}
