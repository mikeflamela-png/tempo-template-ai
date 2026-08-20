import type { PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import type { AudioTrack, TemplateSpec } from "@/lib/template/types";
import { majorEvents } from "@/lib/template/sync";

interface Props {
  spec: TemplateSpec;
  playerRef: RefObject<PlayerRef | null>;
  audio: AudioTrack | null;
  selected: string | null;
  onSelect: (kind: "media" | "text" | "graphic", id: string) => void;
  thumbs: Record<string, string>;
}

/**
 * Simple visual timeline: a shot strip with thumbnails, plus text and graphic
 * lanes. Clicking any block selects it and scrubs the player to its start.
 */
export function Timeline({ spec, playerRef, audio, selected, onSelect, thumbs }: Props) {
  const pct = (v: number) => `${(v / spec.duration) * 100}%`;
  const seek = (t: number) => playerRef.current?.seekTo(Math.round(t * spec.fps));
  const beats = audio?.beatMap
    ? majorEvents(audio.beatMap.events, audio.trimStart).filter((e) => e.time < spec.duration)
    : [];

  return (
    <div className="space-y-1.5 border-t border-border bg-card/40 p-3">
      {/* shots */}
      <div className="relative h-12 w-full overflow-hidden rounded-md bg-black/50">
        {spec.mediaSlots.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              onSelect("media", s.id);
              seek(s.start);
            }}
            title={`${s.label} · ${s.duration.toFixed(2)}s`}
            className={`absolute inset-y-0 overflow-hidden border-r border-black/60 text-left ${
              selected === s.id ? "ring-2 ring-inset ring-primary" : ""
            }`}
            style={{ left: pct(s.start), width: pct(s.duration) }}
          >
            {thumbs[s.id] ? (
              <img src={thumbs[s.id]} alt="" className="size-full object-cover opacity-80" />
            ) : (
              <span className="flex size-full items-center justify-center bg-muted/30 text-[9px] text-muted-foreground">
                {i + 1}
              </span>
            )}
            <span className="absolute bottom-0 left-0 bg-background/70 px-1 text-[8px] tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {/* text lane */}
      <Lane label="TEXT">
        {spec.textSlots.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect("text", t.id);
              seek(t.start);
            }}
            className={`absolute inset-y-0 truncate rounded-sm bg-primary/70 px-1 text-[9px] font-semibold text-primary-foreground ${
              selected === t.id ? "ring-2 ring-primary" : ""
            }`}
            style={{ left: pct(t.start), width: pct(t.duration) }}
          >
            {t.value}
          </button>
        ))}
      </Lane>

      {/* graphics lane */}
      <Lane label="GFX">
        {(spec.graphicSlots ?? []).map((g) => (
          <button
            key={g.id}
            onClick={() => {
              onSelect("graphic", g.id);
              seek(g.start);
            }}
            className={`absolute inset-y-0 truncate rounded-sm bg-accent px-1 text-[9px] font-semibold text-accent-foreground ${
              selected === g.id ? "ring-2 ring-primary" : ""
            }`}
            style={{ left: pct(g.start), width: pct(g.duration) }}
          >
            {g.label ?? g.kind}
          </button>
        ))}
      </Lane>

      {/* music lane */}
      {audio && (
        <Lane label="MUSIC">
          <div className="absolute inset-0 rounded-sm bg-muted/50" />
          {beats.map((b, i) => (
            <span
              key={i}
              className="absolute inset-y-0 w-px bg-foreground/60"
              style={{ left: pct(b.time), opacity: 0.3 + b.strength * 0.7 }}
            />
          ))}
        </Lane>
      )}
    </div>
  );
}

function Lane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[9px] tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-black/30">{children}</div>
    </div>
  );
}
