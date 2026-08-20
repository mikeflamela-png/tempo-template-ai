/**
 * Renders imported motion assets (film burns, light leaks, stickers, sfx…)
 * from `MotionAssetEvent[]` inside a Remotion composition. Resolves each
 * event's asset from the motion asset store and picks the right primitive
 * per kind, preserving transparency (no background fill anywhere).
 */
import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import type { MotionAssetEvent } from "@/lib/template/types";
import { assetKind, motionAssetById, type MotionAsset } from "@/lib/motion/assets";

interface Props {
  events: MotionAssetEvent[];
  width: number;
  height: number;
  fps: number;
}

function transformStyle(ev: MotionAssetEvent, width: number, height: number): React.CSSProperties {
  const x = (ev.x ?? 0) * width;
  const y = (ev.y ?? 0) * height;
  const scale = ev.scale ?? 1;
  const rotate = ev.rotation ?? 0;
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: ev.opacity ?? 1,
    mixBlendMode: (ev.blend ?? "normal") as React.CSSProperties["mixBlendMode"],
    transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
    pointerEvents: "none",
  };
}

/** Lightweight Lottie fallback: shows the first static frame's shapes are not
 * parsed here (no extra dependency) — instead we render nothing visible but
 * never crash. If @remotion/lottie is added later this component is the only
 * place that needs to change. */
function LottieAsset({ asset }: { asset: MotionAsset }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!asset.url) {
      setOk(false);
      return;
    }
    fetch(asset.url)
      .then((r) => r.json())
      .then(() => {
        if (!cancelled) setOk(true);
      })
      .catch(() => {
        if (!cancelled) setOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asset.url]);
  if (!ok) return null;
  // No @remotion/lottie in this project: render nothing (graceful fallback)
  // rather than crash. Swap this for <Lottie/> once the dependency exists.
  return null;
}

function AssetVisual({ ev, asset }: { ev: MotionAssetEvent; asset: MotionAsset }) {
  const kind = assetKind(asset);
  if (!asset.url) return null;
  const speed = ev.speed ?? asset.speed ?? 1;
  const loop = ev.loop ?? asset.loop ?? false;

  switch (kind) {
    case "svg":
    case "image":
      return (
        <Img
          src={asset.url}
          style={{ maxWidth: "none", width: "100%", height: "100%", objectFit: "contain" }}
        />
      );
    case "video":
      return (
        <OffthreadVideo
          src={asset.url}
          muted
          loop={loop}
          playbackRate={Math.max(0.1, speed)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      );
    case "audio":
      return <Audio src={asset.url} loop={loop} playbackRate={Math.max(0.1, speed)} />;
    case "lottie":
      return <LottieAsset asset={asset} />;
    default:
      return null;
  }
}

export function MotionAssetLayer({ events, width, height, fps }: Props) {
  if (typeof window === "undefined") return null;
  if (!events || events.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {events.map((ev) => {
        const asset = motionAssetById(ev.assetId);
        if (!asset) return null;
        const from = Math.max(0, Math.round(ev.start * fps));
        const durationInFrames = Math.max(1, Math.round(ev.duration * fps));
        return (
          <Sequence key={ev.id} from={from} durationInFrames={durationInFrames} layout="none">
            <div style={transformStyle(ev, width, height)}>
              <AssetVisual ev={ev} asset={asset} />
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export default MotionAssetLayer;
