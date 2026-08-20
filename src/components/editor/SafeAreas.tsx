/**
 * SOCIAL SAFE AREAS
 *
 * Configurable overlay guides for common vertical-video placements
 * (avatar/handle stacks, caption zones, CTA buttons, progress bars…) plus a
 * static metadata table and a helper that flags text/graphic slots which
 * bleed into unsafe zones.
 */
import type { CSSProperties } from "react";
import type { GraphicSlot, TemplateSpec, TextSlot } from "@/lib/template/types";

export type Platform = "tiktok" | "reels" | "meta-ads" | "youtube-shorts";

export interface SafeAreaInsets {
  /** fraction of height/width reserved and considered unsafe for key content */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SafeAreaSpec {
  id: Platform;
  label: string;
  /** short description of what lives in the unsafe zones on that platform */
  note: string;
  insets: SafeAreaInsets;
  /** extra guide lines drawn inside the safe area (e.g. caption band) */
  guides?: { at: number; axis: "x" | "y"; label: string }[];
}

/** Insets are fractions (0–1) of the frame's own width/height. */
export const SAFE_AREAS: Record<Platform, SafeAreaSpec> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    note: "Right rail (like/comment/share/profile) + bottom caption/username band + top status bar.",
    insets: { top: 0.09, bottom: 0.2, left: 0.04, right: 0.16 },
    guides: [{ at: 0.5, axis: "y", label: "caption line" }],
  },
  reels: {
    id: "reels",
    label: "Instagram Reels",
    note: "Right rail (like/comment/share/more) + bottom caption/audio band + top profile chip.",
    insets: { top: 0.1, bottom: 0.22, left: 0.04, right: 0.16 },
  },
  "meta-ads": {
    id: "meta-ads",
    label: "Meta Ads (Feed/Reels placement)",
    note: "Profile/CTA header on top, CTA button + primary text band on bottom.",
    insets: { top: 0.12, bottom: 0.18, left: 0.05, right: 0.05 },
  },
  "youtube-shorts": {
    id: "youtube-shorts",
    label: "YouTube Shorts",
    note: "Right rail (like/dislike/comment/share/remix) + bottom title/channel band + top nothing much.",
    insets: { top: 0.04, bottom: 0.16, left: 0.04, right: 0.16 },
  },
};

export const SAFE_AREA_PLATFORMS: Platform[] = ["tiktok", "reels", "meta-ads", "youtube-shorts"];

export interface SafeAreasProps {
  platform: Platform;
  width: number;
  height: number;
  /** dim outside the safe box instead of drawing outline bands only */
  dim?: boolean;
  className?: string;
}

const box: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

export default function SafeAreas({ platform, width, height, dim = true, className }: SafeAreasProps) {
  const spec = SAFE_AREAS[platform];
  if (!spec) return null;
  const { top, bottom, left, right } = spec.insets;
  const topPx = top * height;
  const bottomPx = bottom * height;
  const leftPx = left * width;
  const rightPx = right * width;
  const shade = "rgba(0,0,0,0.55)";
  const line = "1px dashed rgba(255,255,255,0.55)";

  return (
    <div style={box} className={className} aria-hidden data-safe-area={platform}>
      {dim && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: topPx, background: shade, borderBottom: line }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bottomPx, background: shade, borderTop: line }} />
          <div style={{ position: "absolute", left: 0, top: topPx, bottom: bottomPx, width: leftPx, background: shade, borderRight: line }} />
          <div style={{ position: "absolute", right: 0, top: topPx, bottom: bottomPx, width: rightPx, background: shade, borderLeft: line }} />
        </>
      )}
      {!dim && (
        <div
          style={{
            position: "absolute",
            top: topPx,
            bottom: bottomPx,
            left: leftPx,
            right: rightPx,
            border: line,
          }}
        />
      )}
      {(spec.guides ?? []).map((g) => (
        <div
          key={g.label}
          style={
            g.axis === "y"
              ? { position: "absolute", left: leftPx, right: rightPx, top: `${g.at * 100}%`, borderTop: "1px dotted rgba(255,255,255,0.35)" }
              : { position: "absolute", top: topPx, bottom: bottomPx, left: `${g.at * 100}%`, borderLeft: "1px dotted rgba(255,255,255,0.35)" }
          }
          title={g.label}
        />
      ))}
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.65)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {spec.label} safe area
      </div>
    </div>
  );
}

export interface SafeAreaOffender {
  kind: "text" | "graphic";
  id: string;
  label: string;
  reason: string;
}

/**
 * Checks each text/graphic slot's normalized position (x/y, 0–1 centered at
 * 0.5,0.5 when unset) against the platform's unsafe insets. Slots without an
 * explicit x/y default to the slot's `position`/center and are treated as
 * safe unless they carry an explicit offset pushing them out of bounds.
 */
export function respectsSafeArea(spec: TemplateSpec, platform: Platform): SafeAreaOffender[] {
  const area = SAFE_AREAS[platform];
  if (!area) return [];
  const { top, bottom, left, right } = area.insets;
  const offenders: SafeAreaOffender[] = [];

  const normY = (t: TextSlot): number => {
    const base = t.position === "top" ? 0.15 : t.position === "bottom" ? 0.85 : 0.5;
    return base + (t.y ?? 0);
  };
  const normX = (t: TextSlot): number => {
    const base = t.align === "left" ? 0.2 : t.align === "right" ? 0.8 : 0.5;
    return base + (t.x ?? 0);
  };

  for (const t of spec.textSlots) {
    const y = normY(t);
    const x = normX(t);
    if (y < top) offenders.push({ kind: "text", id: t.id, label: t.label || t.value, reason: `sits in the top ${Math.round(top * 100)}% unsafe band` });
    else if (y > 1 - bottom) offenders.push({ kind: "text", id: t.id, label: t.label || t.value, reason: `sits in the bottom ${Math.round(bottom * 100)}% unsafe band` });
    if (x < left) offenders.push({ kind: "text", id: t.id, label: t.label || t.value, reason: `sits in the left ${Math.round(left * 100)}% unsafe band` });
    else if (x > 1 - right) offenders.push({ kind: "text", id: t.id, label: t.label || t.value, reason: `sits in the right ${Math.round(right * 100)}% unsafe band (rail)` });
  }

  for (const g of spec.graphicSlots ?? []) {
    const y = 0.5 + g.y;
    const x = 0.5 + g.x;
    if (y < top || y > 1 - bottom || x < left || x > 1 - right) {
      offenders.push({ kind: "graphic", id: g.id, label: g.label || g.kind, reason: "graphic slot overlaps a platform unsafe zone" });
    }
  }

  return offenders;
}
