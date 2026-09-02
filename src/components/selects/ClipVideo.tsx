import { useEffect, useRef } from "react";
import type { Clip } from "@/lib/footage/types";
import { urlFor } from "@/lib/footage/useSources";

interface Props {
  clip: Clip;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  /** report the playhead in absolute source seconds */
  onTime?: (t: number) => void;
}

/**
 * Plays exactly the trimmed part of a clip, on loop. No video data is copied —
 * this is the original source file with an in/out window.
 */
export function ClipVideo({ clip, className, autoPlay = true, muted = true, onTime }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const url = urlFor(clip.sourceId);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = clip.in;
    if (autoPlay) void v.play().catch(() => {});
  }, [clip.id, clip.in, clip.out, url, autoPlay]);

  if (!url) {
    return <div className={`animate-pulse bg-muted/30 ${className ?? ""}`} aria-hidden />;
  }

  return (
    <video
      ref={ref}
      src={url}
      className={className}
      muted={muted}
      playsInline
      autoPlay={autoPlay}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        onTime?.(v.currentTime);
        if (v.currentTime >= clip.out - 0.03 || v.currentTime < clip.in - 0.3) {
          v.currentTime = clip.in;
          if (autoPlay) void v.play().catch(() => {});
        }
      }}
    />
  );
}

export default ClipVideo;
