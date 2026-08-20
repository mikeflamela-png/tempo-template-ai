/**
 * ASSET RESOLUTION — one place that answers "where is the file for this id?"
 *
 * Motion asset events reference three different libraries by id: imported
 * motion assets, brand assets (logos / product shots used by End Cards) and —
 * on the render worker — files that were uploaded with the job. The Player
 * resolves from the browser stores; the server renderer resolves from the
 * `assetUrls` map that travels with the job. Both go through this module so
 * preview and export cannot diverge.
 */
import { allMotionAssets, assetKind, type AssetKindResolved } from "@/lib/motion/assets";
import { brandKits } from "@/lib/brand/store";
import type { TemplateSpec } from "@/lib/template/types";

export interface ResolvedAsset {
  id: string;
  url: string;
  kind: AssetKindResolved;
  fileName: string;
  mime: string;
  loop?: boolean | undefined;
  speed?: number | undefined;
}

/** Server-side payload: id -> everything the renderer needs, no store access. */
export type AssetUrlMap = Record<
  string,
  { url: string; kind: AssetKindResolved; loop?: boolean; speed?: number }
>;

/** Every asset id a spec needs in order to render exactly like the preview. */
export function collectAssetRefs(spec: TemplateSpec): string[] {
  return [...new Set((spec.motionAssets ?? []).map((m) => m.assetId).filter(Boolean))];
}

/** Browser-side lookup across the motion library and every brand kit. */
export function resolveAssetRef(id: string): ResolvedAsset | null {
  const motion = allMotionAssets().find((a) => a.id === id);
  if (motion?.url) {
    return {
      id,
      url: motion.url,
      kind: assetKind(motion),
      fileName: motion.fileName,
      mime: motion.mime,
      loop: motion.loop,
      speed: motion.speed,
    };
  }
  for (const kit of brandKits()) {
    const asset = kit.assets.find((a) => a.id === id);
    if (asset?.url) {
      return {
        id,
        url: asset.url,
        kind: assetKind({ mime: asset.mime, fileName: asset.fileName }),
        fileName: asset.fileName,
        mime: asset.mime,
      };
    }
  }
  return null;
}
