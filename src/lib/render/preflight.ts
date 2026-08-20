/**
 * EXPORT PREFLIGHT
 *
 * Pure inspection of a TemplateSpec + its resolved media/audio/brand material,
 * run right before a render job is submitted. Nothing here talks to the
 * network or the render worker — it just tells the truth about what's about
 * to be shipped so a "successful" export never quietly drops something.
 */
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";
import type { BrandKit } from "@/lib/brand/store";
import type { EndCard } from "@/lib/brand/endcards";
import type { TypeSystem } from "@/lib/brand/typesystems";
import { renderCompat, type MotionAsset } from "@/lib/motion/assets";

export type PreflightLevel = "block" | "warn" | "info";

export interface PreflightIssue {
  level: PreflightLevel;
  title: string;
  detail: string;
  fix?: string;
}

export interface PreflightInput {
  spec: TemplateSpec;
  media: MediaMap;
  audio?: AudioTrack | null;
  brand?: BrandKit | null;
  /** TypeSystem records referenced by spec.typeSystemIds, resolved by the caller */
  typeSystems?: TypeSystem[];
  /** MotionAsset records referenced by spec.motionAssets, resolved by the caller */
  motionAssets?: MotionAsset[];
  /** EndCard record referenced by spec.endCardId, resolved by the caller */
  endCard?: EndCard | null;
  /** total bytes of the source files about to be uploaded */
  uploadBytes?: number;
}

const MAX_RECOMMENDED_BYTES = 500 * 1024 * 1024; // ~500MB

function bytesLabel(n: number): string {
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(0)}MB`;
}

export function runPreflight(input: PreflightInput): PreflightIssue[] {
  const { spec, media, audio, brand, typeSystems = [], motionAssets = [], endCard, uploadBytes } = input;
  const issues: PreflightIssue[] = [];

  // 1. every media slot has a resolved source
  const missingSlots = spec.mediaSlots.filter((s) => !media[s.id]?.url);
  if (missingSlots.length > 0) {
    issues.push({
      level: "block",
      title: `${missingSlots.length} shot${missingSlots.length === 1 ? "" : "s"} have no media`,
      detail: `Empty: ${missingSlots.map((s) => s.label || s.id).join(", ")}. The render worker will render these as blank frames.`,
      fix: "Fill every shot in the stringout, or auto-fill from the preview reel, before exporting.",
    });
  }

  // 2. total upload byte size
  if (typeof uploadBytes === "number" && uploadBytes > MAX_RECOMMENDED_BYTES) {
    issues.push({
      level: "warn",
      title: `Large upload — ${bytesLabel(uploadBytes)} of source media`,
      detail: "Big uploads can time out or run slowly on the render worker, especially over a weak connection.",
      fix: "Trim unused footage or compress source clips before exporting, if the render stalls.",
    });
  }

  // 3. custom uploaded fonts for referenced type systems
  const usedFontIds = new Set(
    typeSystems.map((t) => t.fontId).filter((id): id is string => Boolean(id)),
  );
  if (usedFontIds.size > 0) {
    const availableFontIds = new Set((brand?.fonts ?? []).map((f) => f.id));
    const missingFonts = [...usedFontIds].filter((id) => !availableFontIds.has(id));
    if (missingFonts.length > 0) {
      issues.push({
        level: "warn",
        title: "A type system references a font that isn't in the active brand kit",
        detail: "The render worker will fall back to a system font, which will not match the preview exactly.",
        fix: "Upload the missing font(s) in the brand kit, or switch the type system to an available font.",
      });
    }
    const erroredFonts = (brand?.fonts ?? []).filter(
      (f) => usedFontIds.has(f.id) && f.status === "error",
    );
    if (erroredFonts.length > 0) {
      issues.push({
        level: "warn",
        title: "A referenced font failed to load",
        detail: `${erroredFonts.map((f) => f.name).join(", ")} did not load in this browser session.`,
        fix: "Re-upload the font file in the brand kit.",
      });
    }
  }

  // 4. motion assets flagged player-only by renderCompat
  const playerOnly = motionAssets.filter((a) => renderCompat(a).level === "player-only");
  if (playerOnly.length > 0) {
    issues.push({
      level: "block",
      title: `${playerOnly.length} motion asset${playerOnly.length === 1 ? "" : "s"} will not survive server rendering`,
      detail: playerOnly
        .map((a) => `${a.name}: ${renderCompat(a).note}`)
        .join(" "),
      fix: "Re-export the asset as WebM with VP9 alpha, or remove it from the edit before rendering.",
    });
  }
  const likely = motionAssets.filter((a) => renderCompat(a).level === "likely");
  if (likely.length > 0) {
    issues.push({
      level: "info",
      title: `${likely.length} motion asset${likely.length === 1 ? "" : "s"} are unverified on the render worker`,
      detail: likely.map((a) => `${a.name}: ${renderCompat(a).note}`).join(" "),
    });
  }

  // 5. audio present but no beat sync
  if (audio && !spec.beatMarkers.length) {
    issues.push({
      level: "info",
      title: "Music is attached but the edit isn't synced to it",
      detail: "No beat markers are set on this timeline, so cuts won't land on the beat.",
      fix: "Use \"Sync to track\" in the Music panel before exporting, if beat sync matters here.",
    });
  }
  if (audio && audio.beatMap && audio.beatMap.duration + 0.25 < spec.duration) {
    issues.push({
      level: "warn",
      title: "Music is shorter than the edit",
      detail: `Track is ${audio.beatMap.duration.toFixed(1)}s, timeline is ${spec.duration.toFixed(1)}s — the render will have silence at the end.`,
    });
  }

  // 6. duration / fps / dimension sanity
  if (spec.duration <= 0) {
    issues.push({ level: "block", title: "Timeline has zero duration", detail: "The spec's duration must be positive." });
  }
  if (spec.fps < 12 || spec.fps > 60) {
    issues.push({
      level: "warn",
      title: `Unusual frame rate: ${spec.fps}fps`,
      detail: "Most delivery targets expect 24–60fps. Very low or high fps can look wrong once encoded.",
    });
  }
  if (spec.width <= 0 || spec.height <= 0 || spec.width % 2 !== 0 || spec.height % 2 !== 0) {
    issues.push({
      level: "block",
      title: "Output dimensions aren't valid for H.264",
      detail: `${spec.width}×${spec.height} — H.264 requires even width and height.`,
    });
  }

  // 7. end card assets resolvable
  if (spec.endCardId) {
    if (!endCard) {
      issues.push({
        level: "warn",
        title: "End card is referenced but couldn't be found",
        detail: `spec.endCardId (${spec.endCardId}) does not match a saved end card.`,
        fix: "Re-select the end card in the brand kit, or remove it from this template.",
      });
    } else {
      const assetIds = [endCard.logoAssetId, endCard.productAssetId, endCard.backgroundAssetId].filter(
        (id): id is string => Boolean(id),
      );
      const available = new Set((brand?.assets ?? []).map((a) => a.id));
      const missingAssets = assetIds.filter((id) => !available.has(id));
      if (missingAssets.length > 0) {
        issues.push({
          level: "warn",
          title: "End card references brand assets that aren't in the active kit",
          detail: "The end card will render without them, e.g. a missing logo or product cutout.",
          fix: "Confirm the correct brand kit is active, or re-upload the missing assets.",
        });
      }
    }
  }

  return issues;
}

export function preflightBlocks(issues: PreflightIssue[]): boolean {
  return issues.some((i) => i.level === "block");
}
