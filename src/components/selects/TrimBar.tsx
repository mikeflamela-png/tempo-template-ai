import { useRef } from "react";
import type { Clip } from "@/lib/footage/types";

interface Props {
  clip: Clip;
  playhead?: number;
  onChange: (patch: { in?: number; out?: number }) => void;
}

/** Dead-simple in/out scrubber. Not a timeline — just clean up the clip. */
export function TrimBar({ clip, playhead, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const span = Math.max(0.1, clip.end - clip.start);
  const pct = (t: number) => ((t - clip.start) / span) * 100;

  const drag = (handle: "in" | "out") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const t = clip.start + f * span;
      if (handle === "in") onChange({ in: Math.min(t, clip.out - 0.2) });
      else onChange({ out: Math.max(t, clip.in + 0.2) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="space-y-1.5">
      <div
        ref={ref}
        className="relative h-8 w-full cursor-pointer rounded-lg border border-border bg-muted/30"
      >
        <div
          className="absolute inset-y-0 rounded-md bg-primary/25"
          style={{ left: `${pct(clip.in)}%`, right: `${100 - pct(clip.out)}%` }}
        />
        {playhead !== undefined && playhead >= clip.start && playhead <= clip.end && (
          <div
            className="absolute inset-y-0 w-px bg-foreground/70"
            style={{ left: `${pct(playhead)}%` }}
          />
        )}
        <button
          onPointerDown={drag("in")}
          aria-label="Trim in point"
          className="absolute inset-y-0 -ml-1.5 w-3 cursor-ew-resize rounded bg-primary"
          style={{ left: `${pct(clip.in)}%` }}
        />
        <button
          onPointerDown={drag("out")}
          aria-label="Trim out point"
          className="absolute inset-y-0 -ml-1.5 w-3 cursor-ew-resize rounded bg-primary"
          style={{ left: `${pct(clip.out)}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>IN {clip.in.toFixed(2)}s</span>
        <span>{(clip.out - clip.in).toFixed(2)}s</span>
        <span>OUT {clip.out.toFixed(2)}s</span>
      </div>
    </div>
  );
}

export default TrimBar;
