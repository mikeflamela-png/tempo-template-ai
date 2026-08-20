import { useCallback, useEffect, useRef, useState } from "react";
import { formatTimecode } from "@/lib/template/reel";

interface Props {
  url: string;
  sourceDuration: number;
  /** locked shot length the window represents */
  window: number;
  inPoint: number;
  onChange: (inPoint: number) => void;
}

const THUMBS = 12;

/**
 * Filmstrip of the source clip with a fixed-width draggable window.
 * The window length is locked to the template's shot duration — the user only
 * chooses WHICH part of the source plays there.
 */
export function SourceScrubber({ url, sourceDuration, window: win, inPoint, onChange }: Props) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.crossOrigin = "anonymous";
    const canvas = document.createElement("canvas");
    const out: string[] = [];

    const grab = (i: number) => {
      if (cancelled || i >= THUMBS) {
        if (!cancelled) setThumbs([...out]);
        return;
      }
      video.currentTime = ((i + 0.5) / THUMBS) * (sourceDuration || video.duration || 1);
      video.onseeked = () => {
        if (cancelled) return;
        canvas.width = 90;
        canvas.height = 160;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            out.push(canvas.toDataURL("image/jpeg", 0.5));
          } catch {
            /* ignore */
          }
        }
        setThumbs([...out]);
        grab(i + 1);
      };
    };

    video.onloadeddata = () => grab(0);
    return () => {
      cancelled = true;
      video.src = "";
    };
  }, [url, sourceDuration]);

  const usable = Math.max(0.01, sourceDuration - win);
  const widthPct = Math.min(100, (win / Math.max(win, sourceDuration)) * 100);
  const leftPct = (Math.min(inPoint, usable) / Math.max(sourceDuration, 0.01)) * 100;

  const seek = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const centered = ratio * sourceDuration - win / 2;
      onChange(Math.max(0, Math.min(usable, Number(centered.toFixed(2)))));
    },
    [onChange, sourceDuration, usable, win],
  );

  return (
    <div className="space-y-1.5">
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seek(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && seek(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        className="relative h-14 cursor-ew-resize overflow-hidden rounded-md border border-border bg-black/60 select-none"
      >
        <div className="flex h-full">
          {(thumbs.length ? thumbs : Array.from({ length: THUMBS })).map((t, i) => (
            <div key={i} className="h-full flex-1 border-r border-black/40 last:border-r-0">
              {typeof t === "string" && (
                <img src={t} alt="" draggable={false} className="size-full object-cover" />
              )}
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 border-2 border-primary bg-primary/15"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
        <span>{formatTimecode(inPoint)}</span>
        <span>window {win.toFixed(2)}s</span>
        <span>{formatTimecode(Math.min(sourceDuration, inPoint + win))}</span>
      </div>
    </div>
  );
}
